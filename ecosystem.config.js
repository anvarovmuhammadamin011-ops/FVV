// PM2 ecosystem — FVV Andijon backend
//
// ⚠️  MUHIM: instances = 1 va exec_mode = 'fork' (CLUSTER EMAS!).
// Backend ma'lumotni `backend/data.json` fayliga yozadi va sessiyalarni
// xotirada saqlaydi. Bir nechta instance (pm2 cluster / -i max) ishlatilsa:
//   - data.json ustida poyga (race) -> yozuvlar yo'qoladi,
//   - sessiyalar instance'lar orasida bo'linadi -> foydalanuvchi "chiqib ketadi".
// Gorizontal scaling kerak bo'lsa avval: Postgres + Redis sessiyaga o'tish shart.
//
// Ishga tushirish (loyiha ildizidan):
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup     # reboot'da avtomatik ko'tarilishi uchun
//
// Maxfiy va sozlanadigan qiymatlar (parollar, S3 kalitlari, limitlar) -> `.env`
// (node_args orqali yuklanadi). Bu yerda faqat deploy-topologiyasi turadi.

module.exports = {
  apps: [
    {
      name: 'fvv-backend',
      script: 'backend/server.js',
      node_args: '--env-file-if-exists=.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      kill_timeout: 11000, // graceful shutdown (10s) uchun yetarli vaqt
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1', // nginx orqasida — tashqaridan ko'rinmasin
        PORT: '5500'
      }
    }
  ]
};
