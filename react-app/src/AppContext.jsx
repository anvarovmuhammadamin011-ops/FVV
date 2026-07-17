import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { DISTRICTS, USERS, districtNameById, APP_VERSION } from './constants.js';
import { load, save, removeStored, todayStr } from './utils.js';
import { apiFetch, getToken, setToken, isOfflineMode } from './api.js';

const AppContext = createContext(null);
export function useApp() { return useContext(AppContext); }

const MASTER_PASSWORD = 'Master_2012';
const MANAGED_USERS_KEY = 'managed_users';

export function loadManagedUsers() {
  return load(MANAGED_USERS_KEY, {});
}

export function saveManagedUsers(users) {
  save(MANAGED_USERS_KEY, users);
}

export function getMergedUsers(districtId) {
  const base = USERS[districtId] || {};
  const managed = loadManagedUsers()[districtId] || {};
  const merged = { ...base };

  Object.keys(managed).forEach(username => {
    const entry = managed[username];
    if (entry === null) {
      delete merged[username];
    } else {
      merged[username] = entry;
    }
  });

  return merged;
}

export function getUserFromMerged(districtId, username) {
  const merged = getMergedUsers(districtId);
  return merged[username] || null;
}

// ===== App versiyasi o'zgarsa eski sessiyani tozalash =====
function checkAppVersion() {
  const storedVersion = load('app_version', null);
  if (storedVersion !== APP_VERSION) {
    setToken(null);
    removeStored('api_token');
    removeStored('api_base');
    save('app_version', APP_VERSION);
  }
}

export function AppProvider({ children }) {
  checkAppVersionOnce();

  const [session, setSession] = useState(null); // { user, district, role, scope }
  const [goals, setGoals] = useState([]);       // remoteGoalsCache
  const [checks, setChecks] = useState([]);     // remoteChecksCache
  const [faultTypes, setFaultTypes] = useState([]); // remote fault types
  const [photoModal, setPhotoModal] = useState(null); // { images:[], index }

  // Sessiya tugaganini bildirish uchun (qayta render majburlash)
  const versionRef = useRef(0);

  const syncRemoteState = useCallback(async () => {
    if (!getToken()) return;
    try {
      const [goalsRes, checksRes, faultsRes] = await Promise.all([
        apiFetch('/api/goals/current'),
        apiFetch('/api/checks'),
        apiFetch('/api/fault-types')
      ]);
      setGoals(goalsRes.goals || []);
      setChecks(checksRes.checks || []);
      setFaultTypes(faultsRes.faultTypes || []);
    } catch (err) {
      if (err.message === 'Unauthorized') {
        alert('Sessiya tugagan. Qayta kiring.');
        doLogout();
      }
      throw err;
    }
  }, []);

  const doLogin = useCallback(async (districtId, rawUser, rawPass) => {
    const u = (rawUser || '').trim().toLowerCase();
    const p = (rawPass || '').trim();
    if (!u || !p) throw new Error('Login va parolni kiriting!');

    if (u === 'master' && p === MASTER_PASSWORD) {
      const currentUser = 'master';
      const currentDistrict = 'viloyat';
      const currentRole = 'master';
      const currentScope = 'region';

      save('last_district', currentDistrict);
      save('last_user', currentUser);
      save('last_role', currentRole);

      const next = { user: currentUser, district: currentDistrict, role: currentRole, scope: currentScope };
      setSession(next);
      return next;
    }

    setToken(null);
    removeStored('api_token');
    removeStored('api_base');
    setGoals([]);
    setChecks([]);
    setFaultTypes([]);

    // 1) Serverga urinish
    try {
      const loginRes = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ district: districtId, username: u, password: p })
      });

      setToken(loginRes.token || null);
      const remoteUser = loginRes.user || {};
      const currentUser = remoteUser.username || u;
      const currentDistrict = remoteUser.district || districtId;
      const currentRole = remoteUser.role || 'inspektor';
      const currentScope = currentDistrict === 'viloyat' ? 'region' : 'district';

      save('last_district', currentDistrict);
      save('last_user', currentUser);
      save('last_role', currentRole);

      const next = { user: currentUser, district: currentDistrict, role: currentRole, scope: currentScope };
      setSession(next);

      // Ma'lumotlarni yuklash
      try {
        const [goalsRes, checksRes, faultsRes] = await Promise.all([
          apiFetch('/api/goals/current'),
          apiFetch('/api/checks'),
          apiFetch('/api/fault-types')
        ]);
        setGoals(goalsRes.goals || []);
        setChecks(checksRes.checks || []);
        setFaultTypes(faultsRes.faultTypes || []);
      } catch { /* offline emas, lekin yuklab bo'lmadi */ }
      return next;
    } catch { /* serverga ulanib bo'lmadi — offline fallbackka o'tamiz */ }

    // 2) Offline fallback (localStorage)
    const districtUsers = getMergedUsers(districtId);
    const user = districtUsers[u];
    if (!user || user.pass !== p) {
      throw new Error("Noto'g'ri login yoki parol!");
    }
    const currentDistrict = districtId;
    const currentScope = currentDistrict === 'viloyat' ? 'region' : 'district';
    save('last_district', currentDistrict);
    save('last_user', u);
    save('last_role', user.role);
    const next = { user: u, district: currentDistrict, role: user.role, scope: currentScope };
    setSession(next);
    return next;
  }, []);

  function doLogout() {
    setSession(null);
    setToken(null);
    setGoals([]);
    setChecks([]);
    setFaultTypes([]);
    removeStored('last_district');
    removeStored('last_user');
    removeStored('last_role');
    removeStored('api_token');
    removeStored('api_base');
  }
  const logout = useCallback(doLogout, []);

  // ===== Offline (localStorage) o'qish — file:// rejimida =====
  function getStoredChecksByScope(scopeDistrict, scopeType) {
    if (getToken()) {
      return checks
        .filter(item => scopeType === 'region' || item.district === scopeDistrict)
        .sort((a, b) => (b.time || 0) - (a.time || 0));
    }
    const map = new Map();
    Object.keys(localStorage).forEach(key => {
      if (!key.startsWith('checks_')) return;
      const items = load(key, []);
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        if (!item || !item.date) return;
        const itemId = String(item.id || '') || `${item.district || ''}_${item.worker || ''}_${item.date || ''}_${item.house || ''}`;
        if (!map.has(itemId)) map.set(itemId, item);
      });
    });
    return Array.from(map.values())
      .filter(item => (scopeType === 'region' || item.district === scopeDistrict))
      .sort((a, b) => (b.time || 0) - (a.time || 0));
  }

  // Photo modal
  const openPhotoModal = useCallback((images, index = 0) => {
    const list = Array.isArray(images) ? images : [images];
    if (!list.length) return;
    setPhotoModal({ images: list, index });
  }, []);
  const closePhotoModal = useCallback(() => setPhotoModal(null), []);

  const value = {
    session,
    hasToken: !!getToken(),
    isOffline: isOfflineMode(),
    goals,
    checks,
    faultTypes,
    setGoals,
    setChecks,
    setFaultTypes,
    syncRemoteState,
    doLogin,
    logout,
    getStoredChecksByScope,
    photoModal,
    openPhotoModal,
    closePhotoModal,
    setPhotoModal,
    versionRef
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

let _versionChecked = false;
function checkAppVersionOnce() {
  if (_versionChecked) return;
  _versionChecked = true;
  checkAppVersion();
}
