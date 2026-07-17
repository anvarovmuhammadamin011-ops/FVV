import { useEffect, useRef, useState } from 'react';
import { useApp, getMergedUsers } from '../AppContext.jsx';
import { districtNameById } from '../constants.js';
import { todayStr, load, save, countResolvedChecks, fileToCompressedBase64, getCheckPhotos } from '../utils.js';
import { apiFetch, getToken } from '../api.js';

// Inspektor (worker) mantig'i — barcha bo'limlar shu hookdan foydalanadi.
export function useWorker() {
  const app = useApp();
  const { session, hasToken, checks, goals, faultTypes, setFaultTypes, getStoredChecksByScope, syncRemoteState } = app;
  const { user, district, scope } = session;

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState('date'); // 'date' | 'all'

  // Forma
  const [editingCheckId, setEditingCheckId] = useState(null);
  const [house, setHouse] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('tekshirildi');
  const [faultNote, setFaultNote] = useState('');
  const [faultCount, setFaultCount] = useState('1');
  const [bartarafCount, setBartarafCount] = useState('0');
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [selectedFaults, setSelectedFaults] = useState([]);
  const [resolvedFaults, setResolvedFaults] = useState([]);
  const fileInputRef = useRef(null);

  // Maqsad formasi
  const [goalMahalla, setGoalMahalla] = useState('');
  const [goalCount, setGoalCount] = useState('');

  const [, setTick] = useState(0);
  const bump = () => setTick(t => t + 1);

  const lookupUsers = getMergedUsers(district);
  const workerName = (lookupUsers[user] && lookupUsers[user].name) ? lookupUsers[user].name : user;
  const workerGoalKey = () => `goal_${district}_${user}`;

  const getAllWorkerChecks = () => {
    const src = hasToken ? checks : getStoredChecksByScope(district, scope);
    return src.filter(i => i.worker === user && i.district === district).sort((a, b) => (b.time || 0) - (a.time || 0));
  };
  const getAllDistrictChecks = () => {
    const src = hasToken ? checks : getStoredChecksByScope(district, scope);
    return src.filter(i => i.district === district).sort((a, b) => (b.time || 0) - (a.time || 0));
  };
  const getWorkerChecks = (date) => getAllWorkerChecks().filter(i => i.date === date);
  const getLatestDate = () => {
    const dates = getAllWorkerChecks().map(i => i.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : todayStr();
  };
  const getGoal = () => hasToken ? (goals.find(g => !g.completed) || null) : load(workerGoalKey(), null);

  useEffect(() => {
    if (hasToken) { syncRemoteState().catch(() => { /* ignore */ }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ma'lumot kelgach sanani oxirgi faol kunga o'rnatamiz (bir marta)
  const initRef = useRef(false);
  const allForInit = getAllWorkerChecks();
  useEffect(() => {
    if (!initRef.current && allForInit.length) {
      initRef.current = true;
      setSelectedDate(getLatestDate());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allForInit.length]);

  function resetForm() {
    setEditingCheckId(null);
    setHouse(''); setOwner(''); setStatus('tekshirildi');
    setFaultNote(''); setFaultCount('1'); setBartarafCount('0');
    setPendingPhotos([]);
    setSelectedFaults([]);
    setResolvedFaults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startEdit(check) {
    setEditingCheckId(check.id);
    setHouse(check.house || '');
    setOwner(check.owner || '');
    setStatus(check.status || 'tekshirildi');
    setFaultNote(check.faultNote || '');
    setFaultCount(String(check.faultCount || 1));
    setBartarafCount(String(check.bartarafCount || 0));
    setPendingPhotos([...getCheckPhotos(check)]);
    setSelectedFaults(check.selectedFaults || []);
    setResolvedFaults(check.resolvedFaults || []);
    setSelectedDate(check.date || selectedDate);
  }

  async function previewPhoto(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const errors = [];
    const fresh = [];
    for (const f of files) {
      try { fresh.push(await fileToCompressedBase64(f)); }
      catch (ex) { errors.push(f.name + ': ' + (ex.message || 'xatolik')); }
    }
    if (fresh.length) setPendingPhotos(prev => [...prev, ...fresh]);
    e.target.value = '';
    if (errors.length) alert('Quyidagi rasmlar yuklanmadi:\n' + errors.join('\n'));
  }
  function removePhoto(index = null) {
    if (typeof index === 'number') setPendingPhotos(prev => prev.filter((_, i) => i !== index));
    else setPendingPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function setGoal() {
    const mahalla = goalMahalla.trim();
    const count = parseInt(goalCount, 10);
    if (!mahalla || !count || count < 1) { alert("Mahalla va xonadon sonini kiriting!"); return; }
    if (getToken()) {
      try { await apiFetch('/api/goals', { method: 'POST', body: JSON.stringify({ mahalla, count }) }); await syncRemoteState(); }
      catch (e) { alert(e.message); return; }
    } else {
      save(workerGoalKey(), { mahalla, count, createdAt: Date.now(), date: todayStr(), completed: false });
      bump();
    }
    setGoalMahalla(''); setGoalCount('');
  }
  async function newGoal() {
    if (getToken()) {
      try {
        await apiFetch('/api/goals/complete', { method: 'PUT' });
        await syncRemoteState();
      } catch (e) { /* ignore */ }
    } else {
      save(workerGoalKey(), null);
      bump();
    }
  }

  async function addCheck() {
    const goal = getGoal();
    const isEditing = editingCheckId !== null;
    const editingCheck = isEditing ? getAllWorkerChecks().find(i => String(i.id) === String(editingCheckId)) : null;
    if (!goal && !isEditing) { alert("Avval maqsad qo'ying!"); return; }

    const h = house.trim(), o = owner.trim();
    if (!h) { alert("Uy raqamini kiriting!"); return; }
    if (!o) { alert("Uy egasining ismini kiriting!"); return; }

    const today = todayStr();
    const entryDate = isEditing ? (editingCheck?.date || today) : today;
    const dateChecks = getWorkerChecks(entryDate);
    if (dateChecks.find(c => (c.house || '').toLowerCase() === h.toLowerCase() && (!isEditing || String(c.id) !== String(editingCheckId)))) {
      alert("Bu uy allaqachon qayd qilingan!"); return;
    }

    let fNote = '', fCount = 0, bCount = 0;
    if (status === 'kamchilik') {
      fNote = faultNote.trim();
      fCount = selectedFaults.length || parseInt(faultCount, 10) || 0;
      bCount = resolvedFaults.length || parseInt(bartarafCount, 10) || 0;
      if (fCount < 1) { alert("Kamchilik tanlang!"); return; }
      if (!fNote) { alert("Kamchilik haqida qisqa izoh kiriting!"); return; }
      if (bCount > fCount) { alert("Bartaraf etilgan soni tavsiya berilgandan ko'p bo'la olmaydi!"); return; }
    }

    const loc = isEditing ? (editingCheck || goal || {}) : (goal || {});
    const payload = {
      id: isEditing ? editingCheckId : Date.now(),
      house: h, owner: o, status,
      faultNote: fNote, faultCount: fCount, bartarafNote: '', bartarafCount: bCount,
      selectedFaults, resolvedFaults,
      photos: pendingPhotos.length ? [...pendingPhotos] : [],
      photo: pendingPhotos[0] || null,
      mahalla: loc.mahalla || '', street: loc.street || '',
      worker: user, workerName, district, districtName: districtNameById(district),
      time: Date.now(), date: entryDate
    };

    if (getToken()) {
      try {
        if (isEditing) await apiFetch(`/api/checks/${editingCheckId}`, { method: 'PUT', body: JSON.stringify(payload) });
        else await apiFetch('/api/checks', { method: 'POST', body: JSON.stringify(payload) });
        await syncRemoteState();
      } catch (e) { alert(e.message); return; }
    } else {
      const key = 'checks_all';
      const all = load(key, []);
      if (isEditing) {
        const gi = all.findIndex(i => String(i.id) === String(editingCheckId));
        if (gi === -1) all.push(payload); else all[gi] = { ...all[gi], ...payload };
      } else all.push(payload);
      try { save(key, all); } catch { alert('Xatolik: brauzer xotirasi yetmadi.'); return; }
      const latest = load(key, []).filter(i => i.worker === user && i.district === district && i.date === today);
      if (goal && countResolvedChecks(latest) >= goal.count) {
        const g = load(workerGoalKey(), null);
        if (g) { g.completed = true; save(workerGoalKey(), g); }
      }
      bump();
    }

    resetForm();
    if (!isEditing) { setSelectedDate(today); setViewMode('date'); }
    return true;
  }

  async function createFaultType(title) {
    if (!title) return null;
    if (getToken()) {
      try {
        const res = await apiFetch('/api/fault-types', { method: 'POST', body: JSON.stringify({ title }) });
        await syncRemoteState();
        return res.faultType;
      } catch (e) { alert(e.message); return null; }
    } else {
      const key = 'faultTypes_all';
      const all = load(key, []);
      if (all.some(f => f.district === district && f.title.toLowerCase() === title.toLowerCase())) {
        alert("Bu kamchilik allaqachon mavjud");
        return null;
      }
      const newFault = { id: Date.now().toString(), district, title, addedBy: user, addedAt: Date.now() };
      all.push(newFault);
      save(key, all);
      setFaultTypes(prev => [...prev, newFault]);
      return newFault;
    }
  }

  return {
    user, district, workerName,
    selectedDate, setSelectedDate, viewMode, setViewMode,
    getAllWorkerChecks, getAllDistrictChecks, getWorkerChecks, getLatestDate, getGoal,
    // form
    editingCheckId, house, setHouse, owner, setOwner, status, setStatus,
    faultNote, setFaultNote, faultCount, setFaultCount, bartarafCount, setBartarafCount,
    pendingPhotos, fileInputRef, previewPhoto, removePhoto,
    selectedFaults, setSelectedFaults, resolvedFaults, setResolvedFaults,
    resetForm, startEdit, addCheck,
    // goal form
    goalMahalla, setGoalMahalla, goalCount, setGoalCount,
    setGoal, newGoal,
    // fault types
    faultTypes: hasToken ? faultTypes : (load('faultTypes_all', []).filter(f => f.district === district)),
    createFaultType,
    openPhotoModal: app.openPhotoModal
  };
}
