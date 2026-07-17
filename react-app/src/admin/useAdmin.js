import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { districtNameById } from '../constants.js';
import { todayStr } from '../utils.js';

// Admin/region paneli uchun umumiy holat va ma'lumot selektorlari.
export function useAdmin() {
  const app = useApp();
  const { session, hasToken, checks, getStoredChecksByScope, syncRemoteState } = app;
  const { district, scope } = session;

  const [viewMode, setViewMode] = useState('date'); // date | all | range
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());

  const scopeChecks = useMemo(
    () => getStoredChecksByScope(district, scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checks, district, scope, hasToken]
  );

  const getChecksForDate = (date) =>
    scopeChecks.filter(i => i.date === date).sort((a, b) => (b.time || 0) - (a.time || 0));
  const getLatestDate = () => {
    const dates = scopeChecks.map(i => i.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : todayStr();
  };

  // Boshlanishida serverdan ma'lumotni yuklaymiz
  useEffect(() => {
    if (hasToken) { syncRemoteState().catch(() => { /* ignore */ }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ma'lumot kelgach (yoki offline) — sanani oxirgi faol kunga o'rnatamiz (bir marta)
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && scopeChecks.length) {
      initRef.current = true;
      setSelectedDate(getLatestDate());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeChecks]);

  const requestedDate = viewMode === 'all' ? getLatestDate() : (selectedDate || todayStr());

  let viewChecks;
  if (viewMode === 'all') viewChecks = scopeChecks;
  else if (viewMode === 'range') viewChecks = scopeChecks.filter(c => c.date >= startDate && c.date <= endDate);
  else viewChecks = getChecksForDate(requestedDate);

  return {
    scope, district, scopeLabel: scope === 'region' ? 'Andijon viloyati' : districtNameById(district),
    viewMode, setViewMode, selectedDate, setSelectedDate, startDate, setStartDate, endDate, setEndDate,
    scopeChecks, getChecksForDate, getLatestDate, requestedDate, viewChecks,
    getStoredChecksByScope
  };
}

export function calc(checks) {
  const kamchilik = checks.filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.faultCount || 0), 0);
  const bartaraf = checks.filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.bartarafCount || 0), 0);
  const done = checks.filter(c => c.status === 'tekshirildi' || (c.status === 'kamchilik' && (c.faultCount || 0) > 0 && (c.bartarafCount || 0) >= (c.faultCount || 0))).length;
  return {
    total: checks.length, done, kamchilik, bartaraf,
    qolgan: Math.max(0, kamchilik - bartaraf),
    workers: new Set(checks.map(c => c.worker)).size
  };
}
