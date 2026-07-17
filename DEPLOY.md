# FVV Andijon — Deploy ma'lumotlari

## Jonli manzillar
- **Frontend (Vercel):** https://fvv-andijon.vercel.app
- **Backend (VPS):** http://157.180.46.214:8080  (faqat `/api` va `/uploads`)
- Vercel loyiha: `oyatbeks-projects/fvv-andijon`

## Arxitektura
```
Brauzer ─HTTPS─▶ Vercel (statik React, fvv-andijon.vercel.app)
                   │  vercel.json rewrites:
                   │   /api/*     ─▶ http://157.180.46.214:8080/api/*
                   │   /uploads/* ─▶ http://157.180.46.214:8080/uploads/*
                   ▼
        VPS nginx (:8080)  ─▶  node backend (127.0.0.1:5500, pm2: fvv-backend)
```
- HTTPS sahifadan HTTP backendga "mixed content" bo'lmasligi uchun chaqiruvlar
  Vercel'ning o'zidan (server tomonda) proxy qilinadi.
- Node faqat `127.0.0.1` da — tashqaridan ko'rinmaydi. nginx faqat `/api` va
  `/uploads` ni ochadi; `server.js`/`data.json` public emas (`/backend/...` → 404).

## Backendni yangilash (kod yoki ma'lumot)
Mahalliy `backend/` yoki `uploads/` o'zgargach:
```bash
cd "/Users/abdukarimov/Desktop/Pajarniy - Copy (6) - Copy"
tar -czf /tmp/fvv-deploy.tar.gz backend/server.js backend/data.json uploads
sshpass -p '<PAROL>' scp /tmp/fvv-deploy.tar.gz root@157.180.46.214:/opt/fvv-backend/
sshpass -p '<PAROL>' ssh root@157.180.46.214 \
  'cd /opt/fvv-backend && tar -xzf fvv-deploy.tar.gz && rm fvv-deploy.tar.gz && pm2 restart fvv-backend'
```
> Diqqat: backend ishlayotganda yangi qaydlar serverdagi
> `/opt/fvv-backend/backend/data.json` ga yoziladi. data.json ni qayta yuklash
> serverdagi yangi yozuvlarni o'chiradi — ehtiyot bo'ling.

## Frontendni qayta deploy qilish
```bash
cd "/Users/abdukarimov/Desktop/Pajarniy - Copy (6) - Copy"
npx vercel deploy --prod --yes
```

## Server tafsilotlari
- pm2 jarayon: `fvv-backend`  (`pm2 logs fvv-backend`, `pm2 restart fvv-backend`)
- nginx konfig: `/etc/nginx/conf.d/fvv-backend.conf`
- ufw: `8080/tcp` ochiq
- joylashuv: `/opt/fvv-backend/{backend, uploads}`
- pm2 startup yoqilgan → reboot'da avtomatik ko'tariladi

## Rasm saqlash (ixtiyoriy: alohida S3/R2 storage)
Default: rasmlar VPS'dagi `uploads/` papkasiga saqlanadi (hech narsa o'zgarmaydi).

Alohida object storage'ga (Cloudflare R2 / AWS S3 / MinIO) o'tkazish:
```bash
# VPS'da:
cd /opt/fvv-backend && npm install @aws-sdk/client-s3
# pm2 env (yoki .env) ga qo'shish:
#   STORAGE_DRIVER=s3
#   S3_BUCKET=... S3_ENDPOINT=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=...
#   S3_PUBLIC_BASE=https://<ochiq-cdn-domen>
pm2 restart fvv-backend --update-env
```
> Storage kodi `server.js` ichida — deploy tar buyrug'i o'zgarmaydi. SDK faqat
> `STORAGE_DRIVER=s3` bo'lganda talab qilinadi (local rejim zero-dep).
> Eski `/uploads/...` rasmlar S3 rejimida ham ishlashda davom etadi.

## Loginlar
- Admin: `admin / 111223` · Inspektor: `ishchi1..8 / 122333` · Viloyat: tuman `viloyat` → `admin / 111223`
