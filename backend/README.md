# Backend

Node.js (`http`) server. Local rejimda zero-dependency. Ma'lumotlar
`data.json` faylida, sessiyalar xotirada (TTL bilan). Frontend alohida
(`react-app`).

## Ishga tushirish

```bash
npm start                       # backend (default 5500)
```

Frontend alohida (`react-app`, Vite) — o'zining dev serveri bilan ishlaydi va
`/api` + `/uploads` ni backendga proxy qiladi:

```bash
cd ../react-app && npm install && npm run dev   # frontend (5173)
```

Konfiguratsiya: `.env` (namuna — `.env.example`). `.env` avtomatik yuklanadi
(`npm start` → `node --env-file-if-exists`). Barcha o'zgaruvchilar ixtiyoriy,
ko'rsatilmasa xavfsiz default ishlatiladi.

## Endpointlar

- `GET  /api/health` — liveness
- `GET  /api/ready` — readiness (ma'lumotlar faylini tekshiradi)
- `GET  /api/districts`
- `POST /api/auth/login`
- `GET  /api/auth/me`
- `GET  /api/goals/current`
- `POST /api/goals`
- `PUT  /api/goals/complete`
- `GET  /api/checks?date=YYYY-MM-DD`
- `POST /api/checks`
- `PUT  /api/checks/:id`
- `GET  /api/fault-types`
- `POST /api/fault-types`
- `GET  /api/admin/summary?date=YYYY-MM-DD`
- `GET  /api/admin/trend?endDate=YYYY-MM-DD&days=7`
- `GET  /api/admin/workers?date=YYYY-MM-DD`
- `GET  /api/admin/compare?date1=YYYY-MM-DD&date2=YYYY-MM-DD`

## Standart loginlar

- Admin: `admin / 111223` (har bir tuman va viloyat panelida)
- Inspektor: `ishchi1..8 / 122333` (har bir tumanda)

Parollarni `ADMIN_PASSWORDS` / `WORKER_PASSWORDS` env orqali o'zgartirish mumkin.

## Rasm saqlash (image storage)

`STORAGE_DRIVER` env orqali tanlanadi:

- `local` (default) — rasmlar `uploads/` papkasiga saqlanadi, `/uploads/...`
  path qaytariladi. Zero-dependency.
- `s3` — rasmlar **alohida object storage**'ga (Cloudflare R2 / AWS S3 /
  MinIO) yuklanadi va to'liq public URL qaytariladi. App stateless bo'ladi,
  VPS diski band bo'lmaydi.

S3 rejimini yoqish:

```bash
# 1) SDK'ni o'rnatish (faqat s3 rejimida kerak)
npm install @aws-sdk/client-s3
# 2) .env da sozlash
STORAGE_DRIVER=s3
S3_BUCKET=fvv-images
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE=https://cdn.example.com   # ochiq CDN/domen
```

Eski `/uploads/...` rasmlar S3 rejimida ham ishlashda davom etadi (backward
compatible). Yangi rasmlargina S3'ga yoziladi. Qayd o'chirilganda/rasm
almashtirilganda eski object avtomatik o'chiriladi.

## Xavfsizlik va barqarorlik xususiyatlari

- Har bir input validatsiya qilinadi (satr uzunligi, sonlar, sana formati).
- So'rov tanasi, rasm hajmi va soni cheklangan (DoS himoyasi).
- Path traversal himoyasi (statik fayl va upload'larda).
- `data.json` atomik yoziladi (temp + rename) — crash paytida buzilmaydi.
- Markazlashgan xato boshqaruvi: client'ga stack/ichki detal chiqmaydi.
- Graceful shutdown (SIGTERM/SIGINT) + `uncaughtException`/`unhandledRejection`.
- Sessiyalar TTL bilan (memory leak yo'q).
- Structured JSON logging (prod) request-id bilan.

## Eslatma

`data.json` fayl-DB va sessiyalar xotirada bo'lgani uchun backend **bitta
instance** sifatida ishlashi kerak (pm2 cluster / bir nechta replica emas).
Rasmlarni S3'ga chiqarish gorizontal scaling sari birinchi qadam; keyingisi —
haqiqiy DB (Postgres) + Redis sessiya.
