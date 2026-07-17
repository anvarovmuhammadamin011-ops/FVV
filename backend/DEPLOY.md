# Backend — to'liq joylashtirish qo'llanmasi (deploy)

FVV Andijon backend — Node.js (`http`) server, `data.json` fayl-DB, xotira
sessiya. Local rejimda **zero-dependency**. Odatiy topologiya:

```
Brauzer ─HTTPS─▶ Vercel (React statik)
                   │  rewrites: /api/* va /uploads/*  ─▶  VPS
                   ▼
             nginx (:8080/:443)  ─▶  node (127.0.0.1:5500, pm2: fvv-backend)
                                          └─ backend/data.json, uploads/
```

> ⚠️ **Bitta instance qoidasi.** Fayl-DB + xotira-sessiya sababli backend
> faqat **1 instance** (pm2 `fork`, `instances: 1`) bo'lishi kerak. Cluster /
> `-i max` / bir nechta pod — ma'lumot yo'qolishi va sessiya buzilishiga olib
> keladi. Gorizontal scaling uchun avval Postgres + Redis kerak.

---

## 0. Talablar
- Node.js **20+ (tavsiya: 24 LTS)**, npm
- Linux VPS (root yoki sudo)
- nginx (reverse proxy)
- pm2 (`npm i -g pm2`) — yoki systemd

Node o'rnatish (Ubuntu, NodeSource):
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

---

## 1. Kodni serverga chiqarish
Joylashuv: `/opt/fvv-backend`. Kerak bo'ladigan narsalar: `backend/`,
`uploads/`, `package.json`, `ecosystem.config.js`, `.env`.

Mahalliy mashinadan (loyiha ildizidan):
```bash
tar -czf /tmp/fvv.tar.gz backend package.json ecosystem.config.js uploads
scp /tmp/fvv.tar.gz root@SERVER_IP:/opt/fvv-backend/
ssh root@SERVER_IP 'cd /opt/fvv-backend && tar -xzf fvv.tar.gz && rm fvv.tar.gz'
```
> `node_modules`, `.env`, `data.backup-*.json` ko'chirilmaydi (`.gitignore`/
> `.vercelignore`ga qarang). `data.json` ni **faqat birinchi marta** yuboring —
> keyin serverdagi jonli nusxani qayta yozib yubormang.

---

## 2. `.env` sozlash
```bash
cd /opt/fvv-backend
cp .env.example .env
nano .env
```
Kamida quyidagilarni sozlang (namuna `.env.example`da):
```ini
NODE_ENV=production
PORT=5500
HOST=127.0.0.1                 # nginx orqasida — tashqaridan yopiq
CORS_ORIGIN=https://fvv-andijon.vercel.app
ADMIN_PASSWORDS=SIZNING_KUCHLI_PAROL
WORKER_PASSWORDS=SIZNING_KUCHLI_PAROL
```
> `.env` maxfiy — git'ga qo'shilmaydi, `chmod 600 .env` qo'ying.
> pm2/shell'da o'rnatilgan qiymat `.env`dan ustun turadi (`ecosystem.config.js`
> `NODE_ENV`, `HOST`, `PORT` ni beradi — qolganini `.env` to'ldiradi).

Zero-dep local rejimda `npm install` **shart emas**. (S3 rejimi uchun — 8-bo'lim.)

---

## 3. Ishga tushirish

### A) Tez sinov (foreground)
```bash
cd /opt/fvv-backend
npm start                       # = node --env-file-if-exists=.env backend/server.js
curl -s localhost:5500/api/health
```

### B) Production — pm2 (tavsiya)
```bash
cd /opt/fvv-backend
pm2 start ecosystem.config.js   # instances:1, fork, --env-file, graceful shutdown
pm2 save                        # ro'yxatni saqlash
pm2 startup                     # reboot'da avtomatik ko'tarilishi (chiqqan buyruqni bajaring)
pm2 logs fvv-backend            # loglar
pm2 restart fvv-backend         # qayta ishga tushirish (graceful)
```

### C) Alternativa — systemd
`/etc/systemd/system/fvv-backend.service`:
```ini
[Unit]
Description=FVV Andijon backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/fvv-backend
ExecStart=/usr/bin/node --env-file-if-exists=.env backend/server.js
Restart=always
RestartSec=2
User=fvv
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=5500
# SIGTERM'da graceful shutdown (server 10s ichida yopadi)
KillSignal=SIGTERM
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fvv-backend
sudo systemctl status fvv-backend
journalctl -u fvv-backend -f
```

---

## 4. nginx (reverse proxy)
`/etc/nginx/conf.d/fvv-backend.conf`:
```nginx
server {
    listen 8080;
    server_name _;

    # Rasm yuklash uchun MUHIM: MAX_BODY_BYTES (30MB) dan katta bo'lsin
    client_max_body_size 30m;

    # Faqat /api va /uploads ochiladi. /backend, data.json va h.k. yopiq.
    location /api/ {
        proxy_pass http://127.0.0.1:5500;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5500;
        proxy_set_header Host $host;
        # (ixtiyoriy) rasm keshlash:
        # proxy_cache_valid 200 7d;  add_header Cache-Control "public, max-age=604800";
    }

    # Qolgan hamma narsa yopiq
    location / { return 404; }
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```
> **`client_max_body_size 30m;` shart** — aks holda nginx katta rasm yuklashni
> node'gacha yetkazmay 413 beradi. `.env`dagi `MAX_BODY_BYTES` bilan mos bo'lsin.

---

## 5. Firewall
```bash
sudo ufw allow 8080/tcp        # nginx porti (yoki 443 TLS bilan)
sudo ufw enable
# Node 127.0.0.1:5500 da — tashqariga ochilmaydi.
```

---

## 6. Tekshirish (verification)
```bash
curl -s localhost:5500/api/health          # {"ok":true,...}
curl -s localhost:5500/api/ready           # {"ok":true} (data.json o'qiladi)
curl -s -X POST localhost:5500/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"district":"asaka","username":"ishchi1","password":"..."}'
```
Tashqaridan: `https://<domen yoki IP:8080>/api/health`.

---

## 7. Yangilash (update) va graceful restart
```bash
# Mahalliy: faqat o'zgargan fayllar
tar -czf /tmp/fvv.tar.gz backend/server.js ecosystem.config.js
scp /tmp/fvv.tar.gz root@SERVER_IP:/opt/fvv-backend/
ssh root@SERVER_IP 'cd /opt/fvv-backend && tar -xzf fvv.tar.gz && rm fvv.tar.gz && pm2 restart fvv-backend --update-env'
```
> `pm2 restart` SIGTERM yuboradi → server jonli so'rovlarni tugatib, `data.json`
> yozuvini xavfsiz yakunlab yopiladi (graceful shutdown). Deploy paytida yozuv
> buzilmaydi.
> **`data.json` ni deploy'ga qo'shmang** — serverdagi jonli yozuvlar o'chib ketadi.

---

## 8. Rasm saqlash — alohida S3/R2 (ixtiyoriy)
Default `local` (uploads/). Alohida object storage'ga o'tkazish:
```bash
cd /opt/fvv-backend
npm install @aws-sdk/client-s3          # faqat s3 rejimida kerak
# .env ga:
#   STORAGE_DRIVER=s3
#   S3_BUCKET=fvv-images
#   S3_ENDPOINT=https://<acc>.r2.cloudflarestorage.com
#   S3_ACCESS_KEY_ID=...  S3_SECRET_ACCESS_KEY=...
#   S3_PUBLIC_BASE=https://<ochiq-cdn-domen>
pm2 restart fvv-backend --update-env
```
Eski `/uploads/...` rasmlar ishlashda davom etadi; faqat yangi rasmlar S3'ga
yoziladi. Bucket public (yoki CDN oldida) bo'lishi kerak.

---

## 9. `data.json` zaxira (backup)
Kunlik cron (masalan `crontab -e`):
```bash
0 2 * * * cp /opt/fvv-backend/backend/data.json /opt/fvv-backups/data-$(date +\%F).json
# 30 kundan eski nusxalarni tozalash
30 2 * * * find /opt/fvv-backups -name 'data-*.json' -mtime +30 -delete
```
Server atomik yozadi (temp + rename), shuning uchun `cp` doim to'liq/valid
faylni oladi.

---

## 10. Troubleshooting
| Alomat | Sabab / yechim |
|---|---|
| Rasm yuklashda 413 | nginx `client_max_body_size` yoki `.env` `MAX_BODY_BYTES` kichik |
| `.env` o'qilmayapti | `npm start` orqali ishga tushiring yoki pm2 `node_args: --env-file...` bor-yo'qligini tekshiring |
| S3'da "aws-sdk o'rnatilmagan" | `npm install @aws-sdk/client-s3` bajaring |
| 500 `DB_CORRUPT` | `data.json` buzilgan — oxirgi backup'dan tiklang, keyin `pm2 restart` |
| Login ishlamayapti | `.env` `ADMIN_PASSWORDS`/`WORKER_PASSWORDS` va yuborilgan `district` to'g'riligini tekshiring |
| Reboot'da ko'tarilmadi | `pm2 save && pm2 startup` (yoki `systemctl enable`) |

Loglar: `pm2 logs fvv-backend` (prod'da JSON, `msg`+`requestId` bilan).
