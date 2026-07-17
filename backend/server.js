'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Konfiguratsiya (barcha env o'qishlari shu yerda — "fail fast" / bitta joy)
// ---------------------------------------------------------------------------
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

const DEFAULT_PORT = toPositiveInt(process.env.PORT, 5500);
const MAX_PORT_ATTEMPTS = 10;
const HOST = process.env.HOST || '0.0.0.0';

const DATA_FILE = path.join(__dirname, 'data.json');
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');

// CORS: '*' yoki aniq origin (masalan https://fvv-andijon.vercel.app)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Xavfsizlik / resurs chegaralari (DoS oldini olish)
const MAX_BODY_BYTES = toPositiveInt(process.env.MAX_BODY_BYTES, 30 * 1024 * 1024); // 30MB (rasmlar base64)
const MAX_IMAGE_BYTES = toPositiveInt(process.env.MAX_IMAGE_BYTES, 8 * 1024 * 1024); // 8MB / rasm
const MAX_PHOTOS = toPositiveInt(process.env.MAX_PHOTOS, 12);
const SESSION_TTL_MS = toPositiveInt(process.env.SESSION_TTL_MS, 12 * 60 * 60 * 1000); // 12 soat
const REQUEST_TIMEOUT_MS = toPositiveInt(process.env.REQUEST_TIMEOUT_MS, 30 * 1000);

// Input uzunlik chegaralari
const LIMITS = Object.freeze({
  HOUSE: 120,
  OWNER: 160,
  MAHALLA: 160,
  NOTE: 2000,
  TITLE: 200,
  USERNAME: 60
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parollar env orqali sozlanadi (kodda sekret saqlamaslik uchun); default -
// mavjud deploy buzilmasin. Vergul bilan ajratiladi.
const ADMIN_PASSWORDS = parseListEnv(process.env.ADMIN_PASSWORDS, ['111223', '123456']);
const WORKER_PASSWORDS = parseListEnv(process.env.WORKER_PASSWORDS, ['122333', '123456']);

const DISTRICTS = [
  { id: 'viloyat', name: 'Andijon viloyati', scope: 'region' },
  { id: 'andijon-shahar', name: 'Andijon shahar', scope: 'district' },
  { id: 'andijon-tuman', name: 'Andijon tuman', scope: 'district' },
  { id: 'asaka', name: 'Asaka', scope: 'district' },
  { id: 'baliqchi', name: 'Baliqchi', scope: 'district' },
  { id: 'boz', name: 'Boz', scope: 'district' },
  { id: 'buloqboshi', name: 'Buloqboshi', scope: 'district' },
  { id: 'izboskan', name: 'Izboskan', scope: 'district' },
  { id: 'jalakuduk', name: 'Jalaquduq', scope: 'district' },
  { id: 'xojabod', name: 'Xojaobod', scope: 'district' },
  { id: 'marhamat', name: 'Marhamat', scope: 'district' },
  { id: 'oltinkol', name: 'Oltinko‘l', scope: 'district' },
  { id: 'paxtaobod', name: 'Paxtaobod', scope: 'district' },
  { id: 'qorgontepa', name: 'Qorgontepa', scope: 'district' },
  { id: 'shahrixon', name: 'Shahrixon', scope: 'district' },
  { id: 'ulugnor', name: 'Ulugnor', scope: 'district' },
  { id: 'xonobod', name: 'Xonobod', scope: 'district' }
];

const USERS = buildUsers();
// token -> { ...session, expiresAt }
const sessions = new Map();

// ---------------------------------------------------------------------------
// Kichik structured logger (zero-dep). Prod: JSON; dev: o'qilishi oson.
// Sezgir ma'lumot (parol/token/body) hech qachon loglanmaydi.
// ---------------------------------------------------------------------------
const logger = createLogger();

// ---------------------------------------------------------------------------
// Operatsion xatolar uchun yagona klass (markazlashgan error handling)
// ---------------------------------------------------------------------------
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ---------------------------------------------------------------------------
// Foydalanuvchilar / autentifikatsiya
// ---------------------------------------------------------------------------
function buildUsers() {
  const users = {
    viloyat: {
      admin: {
        username: 'admin',
        role: 'region',
        name: 'Andijon viloyati',
        district: 'viloyat'
      }
    }
  };

  for (const district of DISTRICTS.filter(item => item.scope === 'district')) {
    users[district.id] = {
      admin: {
        username: 'admin',
        role: 'admin',
        name: `${district.name} boshliq`,
        district: district.id
      }
    };

    for (let i = 1; i <= 8; i++) {
      const username = `ishchi${i}`;
      users[district.id][username] = {
        username,
        role: 'inspektor',
        name: `${district.name} - Ishchi ${i}`,
        district: district.id
      };
    }
  }

  return users;
}

function resolveUserByLogin(districtId, username) {
  const districtUsers = USERS[districtId] || {};
  if (districtUsers[username]) return districtUsers[username];

  if (username === 'viloyat_admin' && districtUsers.admin) {
    return districtUsers.admin;
  }

  if (/_admin$/.test(username) && districtUsers.admin) {
    return districtUsers.admin;
  }

  const legacyWorkerMatch = username.match(/ishchi(\d+)$/);
  if (legacyWorkerMatch) {
    const modernWorker = `ishchi${legacyWorkerMatch[1]}`;
    if (districtUsers[modernWorker]) return districtUsers[modernWorker];
  }

  return null;
}

function isValidPassword(user, inputPassword) {
  const password = String(inputPassword || '').trim();
  if (!password) return false;
  const allowed = (user.role === 'inspektor' || user.role === 'worker')
    ? WORKER_PASSWORDS
    : ADMIN_PASSWORDS;
  // Doimiy-vaqtli taqqoslash (timing attack'ni kamaytirish)
  return allowed.some(candidate => safeEqual(password, candidate));
}

function isWorker(session) {
  return session.role === 'worker' || session.role === 'inspektor';
}

// ---------------------------------------------------------------------------
// Ma'lumotlar fayli (JSON) — atomik yozuv, xavfsiz o'qish
// ---------------------------------------------------------------------------
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    writeDb({ goals: [], checks: [], faultTypes: [] });
  }
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function readDb() {
  ensureDataFile();

  let raw;
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf8');
  } catch (error) {
    logger.error({ msg: 'db_read_failed', err: serializeErr(error) });
    throw new AppError('Ma\'lumotlarni o\'qishda xatolik', 500, 'DB_READ_ERROR', false);
  }

  let db;
  try {
    db = JSON.parse(raw);
  } catch (error) {
    logger.error({ msg: 'db_corrupt', err: serializeErr(error) });
    throw new AppError('Ma\'lumotlar fayli buzilgan', 500, 'DB_CORRUPT', false);
  }

  if (!db || typeof db !== 'object') db = {};
  if (!Array.isArray(db.goals)) db.goals = [];
  if (!Array.isArray(db.checks)) db.checks = [];
  if (!Array.isArray(db.faultTypes)) db.faultTypes = [];
  return db;
}

function writeDb(db) {
  // Atomik yozuv: avval vaqtinchalik faylga, keyin rename. Yozuv o'rtasida
  // crash bo'lsa ham data.json buzilmaydi.
  const tmpFile = `${DATA_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (error) {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    logger.error({ msg: 'db_write_failed', err: serializeErr(error) });
    throw new AppError('Ma\'lumotlarni saqlashda xatolik', 500, 'DB_WRITE_ERROR', false);
  }
}

// ---------------------------------------------------------------------------
// Rasm (upload) boshqaruvi — pluggable storage adapter (local | s3)
// Rasmlar STORAGE_DRIVER ga qarab lokal `uploads/` ga yoki alohida S3-uyg'un
// object storage (Cloudflare R2 / AWS S3 / MinIO) ga saqlanadi.
// ---------------------------------------------------------------------------
function getIncomingPhotos(body) {
  if (Array.isArray(body.photos)) return body.photos;
  if (typeof body.photo === 'string' && body.photo.trim()) return [body.photo.trim()];
  return [];
}

function decodeBase64Image(value) {
  const match = String(value || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const extMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg'
  };

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) return null;
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError('Rasm hajmi juda katta', 413, 'IMAGE_TOO_LARGE');
  }

  return {
    ext: extMap[mime] || mime.split('/')[1].replace(/[^a-z0-9]+/gi, '') || 'jpg',
    mime,
    buffer
  };
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function resolveUploadFile(publicPath) {
  const relativePath = String(publicPath || '').replace(/^\/+/, '');
  const filePath = path.join(UPLOAD_DIR, path.basename(relativePath));
  return isInside(filePath, UPLOAD_DIR) ? filePath : null;
}

// Storage adapterni STORAGE_DRIVER bo'yicha tanlash.
function createStorage(deps = {}) {
  const driver = deps.driver || process.env.STORAGE_DRIVER || 'local';
  if (driver === 's3') return createS3Storage(deps);
  return createLocalStorage();
}

// Lokal fayl tizimi (uploads/). Yozuv/o'chirish async — event loop bloklanmaydi.
function createLocalStorage() {
  return {
    driver: 'local',
    async save({ buffer, ext, keyHint }) {
      ensureUploadDir();
      const fileName = `${keyHint}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
      await fs.promises.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
      return `/uploads/${fileName}`;
    },
    owns(value) {
      return typeof value === 'string' && value.startsWith('/uploads/');
    },
    async remove(value) {
      const filePath = resolveUploadFile(value);
      if (!filePath) return;
      try { await fs.promises.unlink(filePath); } catch { /* fayl allaqachon yo'q */ }
    }
  };
}

// S3-uyg'un object storage (R2 / S3 / MinIO). SDK faqat shu rejimda lazy-require.
function createS3Storage(deps = {}) {
  const bucket = requireEnv('S3_BUCKET');
  const endpoint = process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT.replace(/\/+$/, '') : undefined;
  const region = process.env.S3_REGION || 'auto';
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';
  const acl = process.env.S3_ACL || undefined;
  const keyPrefix = (process.env.S3_KEY_PREFIX || 'checks').replace(/^\/+|\/+$/g, '');
  const publicBase = (process.env.S3_PUBLIC_BASE || (endpoint ? `${endpoint}/${bucket}` : '')).replace(/\/+$/, '');
  if (!publicBase) {
    throw new Error('S3 storage uchun S3_PUBLIC_BASE yoki S3_ENDPOINT majburiy');
  }

  let commands = deps.commands || null;
  let client = deps.client || null;

  function ensureSdk() {
    if (client && commands) return;
    let sdk;
    try {
      sdk = require('@aws-sdk/client-s3');
    } catch {
      throw new Error("S3 storage uchun '@aws-sdk/client-s3' o'rnatilmagan. `npm install @aws-sdk/client-s3` bajaring.");
    }
    if (!commands) {
      commands = { PutObjectCommand: sdk.PutObjectCommand, DeleteObjectCommand: sdk.DeleteObjectCommand };
    }
    if (!client) {
      client = new sdk.S3Client({
        region,
        endpoint,
        forcePathStyle,
        credentials: {
          accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY')
        }
      });
    }
  }

  return {
    driver: 's3',
    async save({ buffer, ext, mime, keyHint }) {
      ensureSdk();
      const key = `${keyPrefix}/${keyHint}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
      await client.send(new commands.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime || 'application/octet-stream',
        ...(acl ? { ACL: acl } : {})
      }));
      return `${publicBase}/${key}`;
    },
    owns(value) {
      return typeof value === 'string' && value.startsWith(`${publicBase}/`);
    },
    async remove(value) {
      ensureSdk();
      const key = String(value).slice(publicBase.length + 1);
      if (!key) return;
      await client.send(new commands.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
  };
}

// Modul yuklanganda bir marta yaratiladi (S3 config noto'g'ri bo'lsa — fail fast).
const storage = createStorage();

// Bitta rasm qiymatini saqlash. Allaqachon saqlangan (bizning storage/tashqi
// URL yoki eski /uploads) qiymatlar o'zgarmasdan qaytariladi; yangi base64 ->
// tanlangan storage'ga yuklanadi va public URL/path qaytariladi.
async function savePhotoValue(photo, keyHint) {
  const value = String(photo || '').trim();
  if (!value) return null;
  if (storage.owns(value)) return value;
  if (value.startsWith('/uploads/')) return value;
  if (/^https?:\/\//i.test(value)) return value;

  const decoded = decodeBase64Image(value);
  if (!decoded) return null;
  return storage.save({ buffer: decoded.buffer, ext: decoded.ext, mime: decoded.mime, keyHint });
}

async function persistPhotos(body, keyHint) {
  const incoming = getIncomingPhotos(body);
  if (incoming.length > MAX_PHOTOS) {
    throw new AppError(`Ko'pi bilan ${MAX_PHOTOS} ta rasm yuklash mumkin`, 400, 'TOO_MANY_PHOTOS');
  }
  // Rasmlar parallel yuklanadi (mustaqil I/O — rule 3.1)
  const saved = await Promise.all(incoming.map(photo => savePhotoValue(photo, keyHint)));
  return saved.filter(Boolean);
}

async function cleanupRemovedPhotos(previousPhotos, nextPhotos) {
  const keep = new Set((nextPhotos || []).filter(p => typeof p === 'string'));
  const toRemove = (previousPhotos || []).filter(p =>
    typeof p === 'string' && !keep.has(p) && storage.owns(p)
  );
  await Promise.all(toRemove.map(p =>
    storage.remove(p).catch(err => logger.warn({ msg: 'photo_cleanup_failed', value: p, err: serializeErr(err) }))
  ));
}

// ---------------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------------
function todayStr() {
  return formatDate(new Date());
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function districtNameById(id) {
  const district = DISTRICTS.find(item => item.id === id);
  return district ? district.name : id;
}

function isResolvedCheck(check) {
  return check.status === 'tekshirildi' || (
    check.status === 'kamchilik' &&
    (check.bartarafCount || 0) >= (check.faultCount || 0)
  );
}

// ---------------------------------------------------------------------------
// HTTP javob helperlari (CORS shu yerda)
// ---------------------------------------------------------------------------
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin'
  };
}

function sendJson(res, statusCode, data) {
  if (res.writableEnded) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders()
  });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  sendJson(res, 404, { error: 'Not found', code: 'NOT_FOUND' });
}

function unauthorized(res) {
  sendJson(res, 401, { error: 'Unauthorized', code: 'UNAUTHORIZED' });
}

function badRequest(res, message, code = 'BAD_REQUEST') {
  sendJson(res, 400, { error: message, code });
}

// Faqat /uploads/ ostidagi rasm fayllarini beradi (frontend alohida).
function serveStatic(req, res, pathname) {
  const filePath = resolveUploadFile(pathname);
  if (!filePath) return notFound(res);
  if (path.basename(filePath).startsWith('.')) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return notFound(res);

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', ...corsHeaders() });
  const stream = fs.createReadStream(filePath);
  stream.on('error', error => {
    logger.error({ msg: 'static_stream_error', path: filePath, err: serializeErr(error) });
    if (!res.headersSent) notFound(res); else res.destroy();
  });
  stream.pipe(res);
}

// So'rov tanasini o'qish — hajm cheklangan (DoS oldini olish), JSON parse
function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let aborted = false;
    const chunks = [];

    req.on('data', chunk => {
      if (aborted) return;
      size += chunk.length;
      if (size > limit) {
        aborted = true;
        reject(new AppError('So\'rov hajmi juda katta', 413, 'PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new AppError('Invalid JSON body', 400, 'INVALID_JSON'));
        }
        resolve(parsed);
      } catch {
        reject(new AppError('Invalid JSON body', 400, 'INVALID_JSON'));
      }
    });

    req.on('error', error => {
      if (!aborted) reject(error);
    });
  });
}

// ---------------------------------------------------------------------------
// Sessiya (TTL bilan — memory leak oldini olish)
// ---------------------------------------------------------------------------
function parseAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  // Faol foydalanuvchi uchun muddatni uzaytirish (sliding expiration)
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function requireAuth(req, res) {
  const session = parseAuth(req);
  if (!session) {
    unauthorized(res);
    return null;
  }
  return session;
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

// ---------------------------------------------------------------------------
// Realtime (WebSocket, RFC 6455 — zero-dep)
//
// Protokol (server -> client push, client faqat auth yuboradi):
//   1) Client `/api/ws` ga ulanadi (token URL'da EMAS — access log'ga tushmasin).
//   2) Client birinchi xabar sifatida {type:'auth', token} yuboradi.
//   3) Server sessiyani tekshiradi: OK -> {type:'ready'}; xato -> close(4001).
//   4) Ma'lumot o'zgarganda server {type:'sync', topic, district} yuboradi —
//      client o'z scope'i bilan qayta fetch qiladi (WS orqali data yuborilmaydi,
//      shuning uchun scope-leak xavfi yo'q).
// ---------------------------------------------------------------------------
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const WS_CLOSE_AUTH_FAILED = 4001;
const WS_MAX_FRAME_BYTES = 64 * 1024; // client faqat auth yuboradi — katta frame shubhali
const WS_AUTH_TIMEOUT_MS = 30 * 1000;
const wsClients = new Set(); // { socket, session|null, alive, buffer, connectedAt }

function wsAcceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
}

function wsEncodeFrame(opcode, payload = Buffer.alloc(0)) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function wsWrite(client, frame) {
  if (client.socket.destroyed) return;
  client.socket.write(frame, error => {
    if (error) wsDestroy(client);
  });
}

function wsSendJson(client, obj) {
  wsWrite(client, wsEncodeFrame(0x1, Buffer.from(JSON.stringify(obj))));
}

function wsClose(client, code) {
  if (wsClients.has(client)) {
    wsClients.delete(client);
    let payload = Buffer.alloc(0);
    if (code) {
      payload = Buffer.alloc(2);
      payload.writeUInt16BE(code, 0);
    }
    try { client.socket.end(wsEncodeFrame(0x8, payload)); } catch { /* ignore */ }
  }
  // end() dan keyin javob kutmaymiz — qisqa muddat ichida uziladi
  setTimeout(() => wsDestroy(client), 1000).unref();
}

function wsDestroy(client) {
  wsClients.delete(client);
  try { client.socket.destroy(); } catch { /* ignore */ }
}

// Kelgan baytlar oqimidan frame'larni ajratish. Client frame'lari doim masked
// (RFC 6455 5.1). Faqat kichik boshqaruv/auth xabarlari kutiladi.
function wsOnData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);

  while (true) {
    const buf = client.buffer;
    if (buf.length < 2) return;

    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let payloadLen = buf[1] & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (buf.length < 4) return;
      payloadLen = buf.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      if (buf.length < 10) return;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(WS_MAX_FRAME_BYTES)) return wsDestroy(client);
      payloadLen = Number(big);
      offset = 10;
    }

    if (payloadLen > WS_MAX_FRAME_BYTES) return wsDestroy(client);
    const maskLen = masked ? 4 : 0;
    if (buf.length < offset + maskLen + payloadLen) return; // to'liq kelmagan

    let payload = buf.subarray(offset + maskLen, offset + maskLen + payloadLen);
    if (masked) {
      const mask = buf.subarray(offset, offset + 4);
      const unmasked = Buffer.allocUnsafe(payloadLen);
      for (let i = 0; i < payloadLen; i++) unmasked[i] = payload[i] ^ mask[i % 4];
      payload = unmasked;
    }
    client.buffer = buf.subarray(offset + maskLen + payloadLen);

    if (opcode === 0x8) return wsClose(client);                       // close
    if (opcode === 0x9) { wsWrite(client, wsEncodeFrame(0xA, payload)); continue; } // ping -> pong
    if (opcode === 0xA) { client.alive = true; continue; }            // pong

    if (opcode === 0x1) {
      // Fragmentlangan xabarlar qo'llanmaydi (auth xabari kichik)
      if (!fin) return wsClose(client);
      wsHandleTextMessage(client, payload.toString('utf8'));
      continue;
    }
    // Boshqa opcode'lar (binary, continuation) kutilmaydi
    return wsClose(client);
  }
}

function wsHandleTextMessage(client, text) {
  let message = null;
  try { message = JSON.parse(text); } catch { /* noto'g'ri format */ }

  if (!client.session) {
    const token = message && message.type === 'auth' ? String(message.token || '') : '';
    const session = token ? sessions.get(token) : null;
    if (!session || session.expiresAt <= Date.now()) {
      return wsClose(client, WS_CLOSE_AUTH_FAILED);
    }
    client.session = session;
    logger.info({ msg: 'ws_auth_ok', username: session.username, district: session.district, clients: wsClients.size });
    return wsSendJson(client, { type: 'ready' });
  }
  // Auth'dan keyingi client xabarlari protokolda yo'q — jimgina e'tiborsiz
}

function attachWebSocket(server) {
  server.on('upgrade', (req, socket) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const upgradeOk = String(req.headers.upgrade || '').toLowerCase() === 'websocket';
      const key = req.headers['sec-websocket-key'];

      if (url.pathname !== '/api/ws' || !upgradeOk || !key) {
        socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
        return socket.destroy();
      }

      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${wsAcceptKey(key)}\r\n\r\n`
      );
      socket.setNoDelay(true);
      socket.setTimeout(0);

      const client = { socket, session: null, alive: true, buffer: Buffer.alloc(0), connectedAt: Date.now() };
      wsClients.add(client);

      socket.on('data', chunk => {
        try { wsOnData(client, chunk); } catch (error) {
          logger.warn({ msg: 'ws_frame_error', err: serializeErr(error) });
          wsDestroy(client);
        }
      });
      socket.on('close', () => wsClients.delete(client));
      socket.on('error', () => wsDestroy(client));
    } catch (error) {
      logger.warn({ msg: 'ws_upgrade_error', err: serializeErr(error) });
      try { socket.destroy(); } catch { /* ignore */ }
    }
  });
}

// Ma'lumot o'zgardi — tegishli scope'dagi klientlarga xabar. Viloyat (region)
// hammasini ko'radi; qolganlar faqat o'z tumanini.
function broadcastSync(topic, district) {
  if (!wsClients.size) return;
  const now = Date.now();
  for (const client of wsClients) {
    const session = client.session;
    if (!session) continue; // hali auth qilmagan
    if (session.expiresAt <= now) { wsClose(client, WS_CLOSE_AUTH_FAILED); continue; }
    if (district && session.role !== 'region' && session.district !== district) continue;
    wsSendJson(client, { type: 'sync', topic, district: district || null });
  }
}

function closeAllWebSockets() {
  for (const client of wsClients) wsDestroy(client);
}

// O'lik ulanishlarni tozalash: 30s da ping; pong kelmasa uziladi.
// Auth qilmagan ulanishlar ham muddat o'tgach yopiladi.
const wsHeartbeatTimer = setInterval(() => {
  const now = Date.now();
  for (const client of wsClients) {
    if (!client.session && client.connectedAt + WS_AUTH_TIMEOUT_MS <= now) { wsClose(client); continue; }
    if (!client.alive) { wsDestroy(client); continue; }
    client.alive = false;
    wsWrite(client, wsEncodeFrame(0x9));
  }
}, 30 * 1000);
wsHeartbeatTimer.unref();

// ---------------------------------------------------------------------------
// Scope filtrlari
// ---------------------------------------------------------------------------
function filterChecksByScope(checks, session, date) {
  return checks.filter(check => {
    if (date && check.date !== date) return false;
    if (session.role === 'region') return true;
    if (session.role === 'admin') return check.district === session.district;
    if (isWorker(session)) {
      return check.district === session.district && check.worker === session.username;
    }
    return false;
  });
}

function filterGoalsByScope(goals, session) {
  if (session.role === 'region') return goals;
  if (session.role === 'admin') return goals.filter(goal => goal.district === session.district);
  if (isWorker(session)) {
    return goals.filter(goal => goal.district === session.district && goal.worker === session.username);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Statistika
// ---------------------------------------------------------------------------
function calcStats(checks) {
  const done = checks.filter(isResolvedCheck).length;
  let kamchilik = 0;
  let bartaraf = 0;
  const workers = new Set();

  for (const item of checks) {
    if (item.status === 'kamchilik') {
      kamchilik += item.faultCount || 0;
      bartaraf += item.bartarafCount || 0;
    }
    if (item.worker) workers.add(item.worker);
  }

  return {
    total: checks.length,
    done,
    kamchilik,
    bartaraf,
    qolgan: Math.max(0, kamchilik - bartaraf),
    activeWorkers: workers.size
  };
}

function getTrend(checks, endDate, days) {
  const trend = [];
  const end = new Date(`${endDate}T00:00:00`);
  // checks'ni sana bo'yicha bir marta guruhlash (N+1 emas, O(n))
  const byDate = new Map();
  for (const item of checks) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  }

  for (let i = days - 1; i >= 0; i--) {
    const current = new Date(end);
    current.setDate(current.getDate() - i);
    const date = formatDate(current);
    trend.push({
      date,
      label: date.slice(5),
      ...calcStats(byDate.get(date) || [])
    });
  }
  return trend;
}

function getDistrictOverview(checks, date) {
  const byDistrict = new Map();
  for (const check of checks) {
    if (date && check.date !== date) continue;
    if (!byDistrict.has(check.district)) byDistrict.set(check.district, []);
    byDistrict.get(check.district).push(check);
  }

  return DISTRICTS
    .filter(item => item.scope === 'district')
    .map(district => ({
      districtId: district.id,
      districtName: district.name,
      ...calcStats(byDistrict.get(district.id) || [])
    }))
    .sort((a, b) => b.done - a.done || b.total - a.total);
}

// ---------------------------------------------------------------------------
// Handlerlar (barchasi async — xatolar markazga bubble bo'ladi)
// ---------------------------------------------------------------------------
async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const districtId = String(body.district || '').trim();
  const username = String(body.username || '').trim().toLowerCase().slice(0, LIMITS.USERNAME);
  const password = String(body.password || '').trim();
  const user = resolveUserByLogin(districtId, username);

  if (!user || !isValidPassword(user, password)) {
    return unauthorized(res);
  }

  const token = crypto.randomUUID();
  const session = {
    token,
    username: user.username,
    role: user.role,
    district: user.district,
    districtName: districtNameById(user.district),
    name: user.name,
    expiresAt: Date.now() + SESSION_TTL_MS
  };

  sessions.set(token, session);
  const { expiresAt, ...publicSession } = session;
  sendJson(res, 200, { token, user: publicSession });
}

async function handleCreateGoal(req, res, session) {
  if (!isWorker(session)) return unauthorized(res);

  const body = await readJsonBody(req);
  const mahalla = String(body.mahalla || '').trim();
  const count = toInt(body.count);

  if (!mahalla) return badRequest(res, 'mahalla va count majburiy');
  if (mahalla.length > LIMITS.MAHALLA) return badRequest(res, 'mahalla nomi juda uzun');
  if (!Number.isFinite(count) || count < 1 || count > 100000) {
    return badRequest(res, 'count 1 dan 100000 gacha butun son bo\'lishi kerak');
  }

  const db = readDb();
  db.goals = db.goals.filter(goal => !(goal.worker === session.username && goal.district === session.district && !goal.completed));
  const goal = {
    id: crypto.randomUUID(),
    district: session.district,
    districtName: districtNameById(session.district),
    worker: session.username,
    workerName: session.name,
    mahalla,
    count,
    createdAt: Date.now(),
    date: todayStr(),
    completed: false
  };
  db.goals.push(goal);
  writeDb(db);
  broadcastSync('goals', session.district);
  sendJson(res, 201, { goal });
}

async function handleCreateCheck(req, res, session) {
  if (!isWorker(session)) return unauthorized(res);

  const body = await readJsonBody(req);
  const db = readDb();
  const activeGoal = db.goals.find(goal =>
    goal.worker === session.username &&
    goal.district === session.district &&
    !goal.completed
  ) || null;

  const house = String(body.house || '').trim();
  const owner = String(body.owner || '').trim();
  if (!house || !owner || !body.status) return badRequest(res, 'house, owner va status majburiy');
  if (house.length > LIMITS.HOUSE) return badRequest(res, 'house juda uzun');
  if (owner.length > LIMITS.OWNER) return badRequest(res, 'owner juda uzun');

  const date = validateOptionalDate(body.date) || todayStr();
  if (body.date && !validateOptionalDate(body.date)) return badRequest(res, 'Sana formati noto\'g\'ri');

  const status = body.status === 'kamchilik' ? 'kamchilik' : 'tekshirildi';
  const faultCount = toInt(body.faultCount || 0);
  const bartarafCount = toInt(body.bartarafCount || 0);
  const countError = validateFaultCounts(status, faultCount, bartarafCount);
  if (countError) return badRequest(res, countError);

  const faultNote = String(body.faultNote || '').trim();
  if (faultNote.length > LIMITS.NOTE) return badRequest(res, 'Izoh juda uzun');

  const mahalla = String(body.mahalla || (activeGoal ? activeGoal.mahalla : '')).trim();
  if (mahalla.length > LIMITS.MAHALLA) return badRequest(res, 'mahalla nomi juda uzun');

  const checkId = crypto.randomUUID();
  const photos = await persistPhotos(body, checkId);

  const check = {
    id: checkId,
    district: session.district,
    districtName: districtNameById(session.district),
    worker: session.username,
    workerName: session.name,
    mahalla,
    house,
    owner,
    status,
    faultCount,
    bartarafCount,
    faultNote,
    photos,
    photo: photos[0] || null,
    date,
    time: Date.now()
  };

  db.checks.push(check);
  if (activeGoal) {
    const doneCount = db.checks.filter(item =>
      item.worker === session.username &&
      item.district === session.district &&
      item.date === activeGoal.date &&
      isResolvedCheck(item)
    ).length;
    if (doneCount >= activeGoal.count) activeGoal.completed = true;
  }

  writeDb(db);
  broadcastSync('checks', session.district);
  sendJson(res, 201, { check });
}

async function handleUpdateCheck(req, res, session, checkId) {
  if (!isWorker(session)) return unauthorized(res);

  const body = await readJsonBody(req);
  const db = readDb();
  const index = db.checks.findIndex(item =>
    item.id === checkId &&
    item.worker === session.username &&
    item.district === session.district
  );

  if (index === -1) return notFound(res);

  const existingCheck = db.checks[index];
  const activeGoal = db.goals.find(goal =>
    goal.worker === session.username &&
    goal.district === session.district &&
    !goal.completed
  ) || db.goals.find(goal =>
    goal.worker === session.username &&
    goal.district === session.district &&
    goal.date === existingCheck.date
  );

  const house = String(body.house || '').trim();
  const owner = String(body.owner || '').trim();
  const status = body.status === 'kamchilik' ? 'kamchilik' : 'tekshirildi';
  if (!house || !owner) return badRequest(res, 'house va owner majburiy');
  if (house.length > LIMITS.HOUSE) return badRequest(res, 'house juda uzun');
  if (owner.length > LIMITS.OWNER) return badRequest(res, 'owner juda uzun');

  const duplicate = db.checks.find(item =>
    item.id !== checkId &&
    item.worker === session.username &&
    item.district === session.district &&
    item.date === existingCheck.date &&
    String(item.house).toLowerCase() === house.toLowerCase()
  );
  if (duplicate) return badRequest(res, 'Bu uy allaqachon qayd qilingan');

  const faultCount = toInt(body.faultCount || 0);
  const bartarafCount = toInt(body.bartarafCount || 0);
  const countError = validateFaultCounts(status, faultCount, bartarafCount);
  if (countError) return badRequest(res, countError);

  const faultNote = String(body.faultNote || '').trim();
  if (faultNote.length > LIMITS.NOTE) return badRequest(res, 'Izoh juda uzun');

  const nextPhotos = await persistPhotos(body, existingCheck.id);
  await cleanupRemovedPhotos(existingCheck.photos || (existingCheck.photo ? [existingCheck.photo] : []), nextPhotos);

  db.checks[index] = {
    ...existingCheck,
    house,
    owner,
    status,
    faultCount,
    bartarafCount,
    faultNote,
    photos: nextPhotos,
    photo: nextPhotos[0] || null,
    districtName: districtNameById(session.district),
    mahalla: activeGoal ? activeGoal.mahalla : existingCheck.mahalla,
    time: Date.now()
  };

  const relatedGoal = db.goals.find(goal =>
    goal.worker === session.username &&
    goal.district === session.district &&
    goal.date === existingCheck.date
  );
  if (relatedGoal) {
    const doneCount = db.checks.filter(item =>
      item.worker === session.username &&
      item.district === session.district &&
      item.date === relatedGoal.date &&
      isResolvedCheck(item)
    ).length;
    relatedGoal.completed = doneCount >= relatedGoal.count;
  }

  writeDb(db);
  broadcastSync('checks', session.district);
  sendJson(res, 200, { check: db.checks[index] });
}

async function handleCreateFaultType(req, res, session) {
  const body = await readJsonBody(req);
  const title = String(body.title || '').trim();
  if (!title) return badRequest(res, 'title majburiy');
  if (title.length > LIMITS.TITLE) return badRequest(res, 'title juda uzun');

  const db = readDb();
  if (db.faultTypes.some(f => f.district === session.district && String(f.title).toLowerCase() === title.toLowerCase())) {
    return badRequest(res, 'Bu kamchilik allaqachon mavjud');
  }
  const newFault = {
    id: crypto.randomUUID(),
    district: session.district,
    title,
    addedBy: session.username,
    addedAt: Date.now()
  };
  db.faultTypes.push(newFault);
  writeDb(db);
  broadcastSync('faultTypes', session.district);
  sendJson(res, 201, { faultType: newFault });
}

// ---------------------------------------------------------------------------
// Router (dispatch) — barcha xatolar markaziy try/catch orqali boshqariladi
// ---------------------------------------------------------------------------
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'fvv-andijon-backend', uptime: Math.round(process.uptime()) });
  }

  if (req.method === 'GET' && url.pathname === '/api/ready') {
    try {
      readDb();
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 503, { ok: false, error: 'Ma\'lumotlar fayli tayyor emas' });
    }
  }

  // Backend faqat yuklangan rasmlarni beradi. Frontend alohida (react-app /
  // Vercel). Boshqa statik fayllar (config, kod) oshkor qilinmaydi.
  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    return serveStatic(req, res, url.pathname);
  }

  // Qolgan non-/api GET -> 404 (statik frontend bu serverda emas)
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    return notFound(res);
  }

  if (req.method === 'GET' && url.pathname === '/api/districts') {
    return sendJson(res, 200, {
      districts: DISTRICTS,
      accounts: DISTRICTS.map(district => ({
        districtId: district.id,
        districtName: district.name,
        usernames: Object.keys(USERS[district.id] || {})
      }))
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    return handleLogin(req, res);
  }

  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const { expiresAt, ...publicSession } = session;
    return sendJson(res, 200, { user: publicSession });
  }

  if (req.method === 'GET' && url.pathname === '/api/goals/current') {
    const db = readDb();
    const goals = filterGoalsByScope(db.goals, session).filter(goal => !goal.completed);
    return sendJson(res, 200, { goals });
  }

  if (req.method === 'POST' && url.pathname === '/api/goals') {
    return handleCreateGoal(req, res, session);
  }

  if (req.method === 'PUT' && url.pathname === '/api/goals/complete') {
    const db = readDb();
    const goal = db.goals.find(g => g.worker === session.username && g.district === session.district && !g.completed);
    if (goal) { goal.completed = true; writeDb(db); broadcastSync('goals', session.district); }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/checks') {
    const db = readDb();
    const date = validateOptionalDate(url.searchParams.get('date'));
    const checks = filterChecksByScope(db.checks, session, date);
    return sendJson(res, 200, { checks, stats: calcStats(checks) });
  }

  if (req.method === 'POST' && url.pathname === '/api/checks') {
    return handleCreateCheck(req, res, session);
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/checks/')) {
    const checkId = decodeURIComponent(url.pathname.split('/').pop() || '');
    if (!checkId) return badRequest(res, 'check id majburiy');
    return handleUpdateCheck(req, res, session, checkId);
  }

  if (req.method === 'GET' && url.pathname === '/api/fault-types') {
    const db = readDb();
    const faults = db.faultTypes.filter(f => session.role === 'region' || f.district === session.district);
    return sendJson(res, 200, { faultTypes: faults });
  }

  if (req.method === 'POST' && url.pathname === '/api/fault-types') {
    return handleCreateFaultType(req, res, session);
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/summary') {
    const db = readDb();
    const date = validateOptionalDate(url.searchParams.get('date')) || todayStr();
    const checks = filterChecksByScope(db.checks, session, date);
    return sendJson(res, 200, { date, stats: calcStats(checks), checks });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/trend') {
    const db = readDb();
    const endDate = validateOptionalDate(url.searchParams.get('endDate')) || todayStr();
    const days = clampInt(url.searchParams.get('days'), 7, 1, 90);
    const checks = filterChecksByScope(db.checks, session);
    return sendJson(res, 200, { trend: getTrend(checks, endDate, days) });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/workers') {
    const db = readDb();
    const date = validateOptionalDate(url.searchParams.get('date')) || todayStr();
    const checks = filterChecksByScope(db.checks, session, date);

    if (session.role === 'region') {
      return sendJson(res, 200, { mode: 'districts', items: getDistrictOverview(checks, date) });
    }

    const items = Object.values(USERS[session.district] || {})
      .filter(user => user.role === 'worker' || user.role === 'inspektor')
      .map(user => {
        const workerChecks = checks.filter(check => check.worker === user.username);
        return {
          worker: user.username,
          workerName: user.name,
          ...calcStats(workerChecks)
        };
      });

    return sendJson(res, 200, { mode: 'workers', items });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/compare') {
    const db = readDb();
    const checks = filterChecksByScope(db.checks, session);

    if (session.role === 'region') {
      const date = validateOptionalDate(url.searchParams.get('date')) || todayStr();
      return sendJson(res, 200, {
        mode: 'districts',
        date,
        items: getDistrictOverview(checks, date)
      });
    }

    const date1 = validateOptionalDate(url.searchParams.get('date1'));
    const date2 = validateOptionalDate(url.searchParams.get('date2'));
    if (!date1 || !date2) return badRequest(res, 'date1 va date2 majburiy (YYYY-MM-DD)');

    const checks1 = checks.filter(item => item.date === date1);
    const checks2 = checks.filter(item => item.date === date2);
    return sendJson(res, 200, {
      date1,
      date2,
      stats1: calcStats(checks1),
      stats2: calcStats(checks2)
    });
  }

  notFound(res);
}

// Markaziy so'rov ishlovchisi: request-id, logging, xato ushlash
function serverHandler(req, res) {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const url = req.url || '';
    // Statik fayllarning muvaffaqiyatli javoblarini loglamaymiz (shovqinni kamaytirish)
    if (!url.startsWith('/api/') && res.statusCode < 400) return;
    if (url === '/api/health' && res.statusCode < 400) return;
    const ms = Date.now() - started;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      msg: 'request',
      requestId,
      method: req.method,
      url,
      status: res.statusCode,
      ms,
      slow: ms > 500
    });
  });

  Promise.resolve()
    .then(() => route(req, res))
    .catch(error => handleRequestError(error, req, res, requestId));
}

function handleRequestError(error, req, res, requestId) {
  const isApp = error instanceof AppError;
  const statusCode = isApp ? error.statusCode : 500;
  const operational = isApp && error.isOperational;

  if (!operational) {
    logger.error({
      msg: 'unhandled_request_error',
      requestId,
      method: req.method,
      url: req.url,
      err: serializeErr(error)
    });
  }

  if (res.headersSent || res.writableEnded) {
    try { res.destroy(); } catch { /* ignore */ }
    return;
  }

  const message = operational ? error.message : 'Serverda xatolik yuz berdi';
  sendJson(res, statusCode, { error: message, code: isApp ? error.code : 'INTERNAL_ERROR' });
}

// ---------------------------------------------------------------------------
// Kichik yordamchi funksiyalar
// ---------------------------------------------------------------------------
function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function clampInt(value, fallback, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function validateFaultCounts(status, faultCount, bartarafCount) {
  if (!Number.isFinite(faultCount) || faultCount < 0 || faultCount > 100000) {
    return 'faultCount 0 dan 100000 gacha bo\'lishi kerak';
  }
  if (!Number.isFinite(bartarafCount) || bartarafCount < 0) {
    return 'bartarafCount manfiy bo\'la olmaydi';
  }
  if (status === 'kamchilik' && faultCount < 1) {
    return 'kamchilik soni kamida 1 bo\'lishi kerak';
  }
  if (bartarafCount > faultCount) {
    return 'Bartaraf etilgan soni kamchilikdan ko\'p bo\'la olmaydi';
  }
  return null;
}

function validateOptionalDate(value) {
  if (value == null || value === '') return null;
  const str = String(value);
  if (!DATE_RE.test(str)) return null;
  const parsed = Date.parse(`${str}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : str;
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseListEnv(value, fallback) {
  if (!value) return fallback;
  const list = String(value).split(',').map(item => item.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Muhit o'zgaruvchisi majburiy: ${name}`);
  return String(value);
}

function serializeErr(error) {
  if (!error) return error;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: IS_PROD ? undefined : error.stack
  };
}

function createLogger() {
  const levels = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
  const minLevel = IS_PROD ? levels.info : levels.debug;

  function emit(level, payload) {
    if (levels[level] < minLevel) return;
    const record = typeof payload === 'string' ? { msg: payload } : { ...payload };
    record.level = level;
    record.time = new Date().toISOString();

    if (IS_PROD) {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    } else {
      const { msg, time, level: lvl, ...rest } = record;
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
      const line = `[${time}] ${lvl.toUpperCase().padEnd(5)} ${msg || ''}${extra}`;
      if (level === 'error' || level === 'fatal') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
    }
  }

  return {
    debug: payload => emit('debug', payload),
    info: payload => emit('info', payload),
    warn: payload => emit('warn', payload),
    error: payload => emit('error', payload),
    fatal: payload => emit('fatal', payload)
  };
}

// ---------------------------------------------------------------------------
// Serverni ishga tushirish
// ---------------------------------------------------------------------------
function startServer(port = DEFAULT_PORT, attempt = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(serverHandler);
    attachWebSocket(server);

    // Slow-loris va osilib qolgan so'rovlar himoyasi
    server.requestTimeout = REQUEST_TIMEOUT_MS;
    server.headersTimeout = REQUEST_TIMEOUT_MS + 5000;
    server.keepAliveTimeout = 65 * 1000;

    server.on('error', error => {
      if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        const nextPort = port + 1;
        logger.warn({ msg: 'port_in_use', port, nextPort });
        startServer(nextPort, attempt + 1).then(resolve).catch(reject);
        return;
      }
      reject(error);
    });

    server.listen(port, HOST, () => {
      resolve({ server, port, host: HOST });
    });
  });
}

// Sessiyalarni davriy tozalash (memory leak oldini olish). Process'ni ushlab
// turmaydi (unref).
const sessionCleanupTimer = setInterval(cleanupSessions, 30 * 60 * 1000);
sessionCleanupTimer.unref();

ensureDataFile();

module.exports = {
  startServer,
  // testlash uchun ochiladi
  __internals: { AppError, validateFaultCounts, validateOptionalDate, isInside, calcStats, createStorage, decodeBase64Image }
};

// Faqat to'g'ridan-to'g'ri ishga tushirilganda (production entry).
// dev-server.js import qilganda o'zining shutdown/proxy mantig'ini boshqaradi.
if (require.main === module) {
  let httpServer = null;
  let shuttingDown = false;

  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ msg: 'shutdown_start', signal });

    const forceExit = setTimeout(() => {
      logger.error({ msg: 'shutdown_forced' });
      process.exit(1);
    }, 10000);
    forceExit.unref();

    closeAllWebSockets(); // ochiq WS ulanishlar server.close() ni ushlab turmasin

    if (httpServer) {
      httpServer.close(() => {
        logger.info({ msg: 'shutdown_complete' });
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // uncaughtException'dan keyin holat ishonchsiz — logga yozib, restart uchun chiqamiz
  process.on('uncaughtException', error => {
    logger.fatal({ msg: 'uncaught_exception', err: serializeErr(error) });
    process.exit(1);
  });

  process.on('unhandledRejection', reason => {
    logger.fatal({ msg: 'unhandled_rejection', err: serializeErr(reason instanceof Error ? reason : new Error(String(reason))) });
    process.exit(1);
  });

  startServer()
    .then(({ server, port, host }) => {
      httpServer = server;
      logger.info({ msg: 'server_started', url: `http://${host}:${port}`, env: NODE_ENV });
    })
    .catch(error => {
      logger.fatal({ msg: 'server_start_failed', err: serializeErr(error) });
      process.exit(1);
    });
}
