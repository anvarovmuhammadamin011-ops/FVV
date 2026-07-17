// ===== STORAGE =====
export function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
export function load(key, def = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
export function removeStored(key) { localStorage.removeItem(key); }

// ===== DATE HELPERS =====
export function todayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
export function fmtDate(d) { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}.${m}.${y}`; }
export function fmtTime(ts) { return new Date(ts).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }); }

export function isResolvedCheck(check) {
  return check.status === 'tekshirildi' || (
    check.status === 'kamchilik' &&
    (check.faultCount || 0) > 0 &&
    (check.bartarafCount || 0) >= (check.faultCount || 0)
  );
}
export function countResolvedChecks(checks) {
  return checks.filter(isResolvedCheck).length;
}

export function getCheckPhotos(c) {
  return Array.isArray(c.photos) && c.photos.length ? c.photos : (c.photo ? [c.photo] : []);
}

export function calcStats(checks) {
  const kamchilik = checks.filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.faultCount || 0), 0);
  const bartaraf = checks.filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.bartarafCount || 0), 0);
  return {
    total: checks.length,
    done: countResolvedChecks(checks),
    kamchilik,
    bartaraf,
    qolgan: Math.max(0, kamchilik - bartaraf),
    workers: new Set(checks.map(c => c.worker)).size,
    mahallas: [...new Set(checks.map(c => c.mahalla))].filter(Boolean)
  };
}

// Trend ma'lumotlari (oxirgi N kun)
export function getTrendData(days, endDateStr, checksForDate) {
  const result = [];
  const endDate = new Date(`${endDateStr}T00:00:00`);
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    result.push({
      label: fmtDate(dateStr).slice(0, 5),
      checked: checksForDate(dateStr).length
    });
  }
  return result;
}

// Rasmni siqib base64 ga aylantirish
export function fileToCompressedBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Fayl rasm emas'));
      return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        try {
          const MAX = 1200;
          let w = img.width || 800;
          let h = img.height || 600;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          if (w < 1) w = 1;
          if (h < 1) h = 1;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
          resolve(dataUrl);
        } catch (ex) {
          reject(ex);
        }
      };
      img.onerror = function () { reject(new Error("Rasmni o'qishda xatolik")); };
      img.src = ev.target.result;
    };
    reader.onerror = function () { reject(new Error("Faylni o'qishda xatolik")); };
    reader.readAsDataURL(file);
  });
}
