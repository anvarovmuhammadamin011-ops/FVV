import { getToken } from './api.js';

// Realtime (WebSocket) mijoz.
// Server ma'lumot o'zgarganda {type:'sync'} yuboradi — biz esa o'z token/scope
// bilan qayta fetch qilamiz (WS orqali ma'lumotning o'zi kelmaydi).
//
// Protokol: ulanib bo'lgach client {type:'auth', token} yuboradi;
// server javobi {type:'ready'} yoki close(4001) — token yaroqsiz.

const AUTH_FAILED_CODE = 4001;
const SYNC_DEBOUNCE_MS = 300;
const MAX_RECONNECT_DELAY_MS = 30000;

let socket = null;
let onSync = null;
let running = false;
let attempts = 0;
let reconnectTimer = null;
let syncTimer = null;

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws`;
}

// Ketma-ket kelgan sync xabarlarini bitta refetch'ga jamlash
function scheduleSync() {
  if (syncTimer) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (running && onSync) onSync();
  }, SYNC_DEBOUNCE_MS);
}

function connect() {
  if (!running || socket) return;
  if (!getToken()) return;

  let ws;
  try {
    ws = new WebSocket(wsUrl());
  } catch {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    const token = getToken();
    if (!token) { ws.close(); return; }
    ws.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = event => {
    let message = null;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'ready') {
      attempts = 0;
      scheduleSync(); // uzilish paytida o'tkazib yuborilgan o'zgarishlarni olish
    } else if (message.type === 'sync') {
      scheduleSync();
    }
  };

  ws.onclose = event => {
    if (socket === ws) socket = null;
    if (!running) return;
    if (event.code === AUTH_FAILED_CODE) {
      // Sessiya yaroqsiz — qayta ulanish foydasiz; keyingi apiFetch 401 beradi
      running = false;
      return;
    }
    scheduleReconnect();
  };

  ws.onerror = () => {
    try { ws.close(); } catch { /* ignore */ }
  };
}

function scheduleReconnect() {
  if (!running || reconnectTimer) return;
  attempts += 1;
  const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(attempts, 5));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// Tab yana ko'ringanida darhol qayta ulanish (backoff'ni kutmasdan)
function handleVisibility() {
  if (document.visibilityState !== 'visible' || !running || socket) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  attempts = 0;
  connect();
}

export function startRealtime(callback) {
  onSync = callback;
  if (running) return;
  running = true;
  attempts = 0;
  document.addEventListener('visibilitychange', handleVisibility);
  connect();
}

export function stopRealtime() {
  running = false;
  onSync = null;
  document.removeEventListener('visibilitychange', handleVisibility);
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  if (socket) {
    try { socket.close(); } catch { /* ignore */ }
    socket = null;
  }
}
