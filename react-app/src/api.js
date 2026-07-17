import { load, save } from './utils.js';

let authToken = load('api_token', null);
let resolvedApiBase = load('api_base', window.location.protocol === 'file:' ? 'http://localhost:5500' : '');

export function getToken() { return authToken; }
export function setToken(token) {
  authToken = token || null;
  if (authToken) save('api_token', authToken);
  else localStorage.removeItem('api_token');
}

export function isOfflineMode() {
  return window.location.protocol === 'file:';
}

async function resolveApiBase() {
  if (!isOfflineMode()) return '';

  const candidates = [];
  if (resolvedApiBase) candidates.push(resolvedApiBase);
  for (let port = 5500; port <= 5510; port++) {
    const base = `http://localhost:${port}`;
    if (!candidates.includes(base)) candidates.push(base);
  }
  // 5501 portni ham qo'shamiz (backend server)
  const base5501 = 'http://localhost:5501';
  if (!candidates.includes(base5501)) candidates.push(base5501);

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}/api/health`, { method: 'GET' });
      if (response.ok) {
        resolvedApiBase = base;
        save('api_base', resolvedApiBase);
        return base;
      }
    } catch { /* keyingi nomzodga o'tamiz */ }
  }

  throw new Error('Backend topilmadi. `npm start` bilan serverni ishga tushiring.');
}

export async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const apiBase = await resolveApiBase();

  const response = await fetch(`${apiBase}${path}`, { ...options, headers });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Server bilan ishlashda xatolik yuz berdi');
  }
  return data;
}
