# FVV Andijon – Monitoring Tizimi (React)

Eski vanilla-JS ilova React (Vite) ga ko'chirildi va **dizayni to'liq yangilandi**.
Backend (`../backend/server.js`) o'zgarmagan.

## Dizayn tamoyillari
- **Oq + navy monoxrom** — boshqa rang, shade yoki gradiyent yo'q.
  Hierarxiya inversiya orqali: oq yuzalar, navy hairline chiziqlar, navy to'ldirish.
  Grafiklarda seriyalar navy ning shaffoflik darajalari bilan ajratiladi.
- **Chap sidebar navigatsiya** — har bir bo'lim alohida sahifa (bitta sahifaga bog'lanmagan).
- **Reusable komponentlar** — `src/ui/` dagi primitivlar butun ilovada qayta ishlatiladi.
- **Boyitilgan grafiklar** — line (14 kunlik, 2 seriya), donut (holat), bar / grouped bar.
- **Umumiy + batafsil** — overview (agregat) bo'limlari + o'ngdan ochiluvchi **drawer** orqali
  har bir qayd / tuman / inspektor bo'yicha to'liq tafsilot.

## Bo'limlar
- **Inspektor:** Boshqaruv · Yangi qayd · Qaydlar tarixi
- **Admin:** Umumiy · Qaydlar · Tumanlar reytingi · Inspektorlar · Solishtirish
- **Viloyat (region):** xuddi admin, lekin Solishtirish = tumanlarni taqqoslash

## Ishga tushirish
```bash
# 1) backend (loyiha ildizidan, port 5500)
npm start
# 2) frontend (shu papkadan)
npm install
npm run dev          # /api va /uploads avtomatik backendga proxy
```
Boshqa port: `BACKEND_URL=http://localhost:5501 npm run dev`

## Loginlar
- Admin: `admin / 111223`
- Inspektor: `ishchi1..8 / 122333`
- Viloyat: `viloyat` tumani → `admin / 111223`

## Tuzilma
```
src/
  theme.css              dizayn tizimi (oq + navy)
  constants.js utils.js api.js   ma'lumot/yordamchilar
  AppContext.jsx         login/logout, sync, photo modal, global holat
  hooks.js               useClock (topbar soati)
  ui/
    index.jsx            Button, Card, Stat, Segmented, Field, Drawer, Badge, Progress, ...
    charts.jsx           LineChart, BarChart, GroupedBarChart, DonutChart (monoxrom navy)
  layout/AppLayout.jsx   sidebar + topbar
  components/
    CheckTable.jsx       qaydlar jadvali
    CheckDetailDrawer.jsx  qayd tafsiloti (drawer)
    LoginPage.jsx  PhotoModal.jsx
  worker/                useWorker.js + Dashboard / NewCheck / History + WorkerApp
  admin/                 useAdmin.js + Overview / Checks / Districts / Inspectors / Compare + AdminApp
```

## Eslatma
Eski `app.js` da `startClock(...)` aniqlanmagan edi (ReferenceError, sahifa init'ini buzardi).
Yangi versiyada bu — topbardagi jonli soat — `useClock` orqali to'g'ri ishlatildi.
