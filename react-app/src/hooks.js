import { useEffect, useState } from 'react';

// Original app.js da `startClock(...)` chaqirilgan, lekin hech qayerda
// aniqlanmagan (ReferenceError). Topbar uchun jonli soat — aniq ko'zlangan
// xatti-harakat shu bo'lgani uchun shu hook orqali to'g'ri amalga oshiramiz.
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
