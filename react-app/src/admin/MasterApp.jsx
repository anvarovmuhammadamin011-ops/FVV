import { useEffect, useMemo, useState } from 'react';
import { useApp, loadManagedUsers, saveManagedUsers, getMergedUsers } from '../AppContext.jsx';
import AppLayout from '../layout/AppLayout.jsx';
import { DISTRICTS, USERS, districtNameById } from '../constants.js';
import { Button, Card, Field } from '../ui/index.jsx';

export default function MasterApp() {
  const { logout } = useApp();
  const [managedUsers, setManagedUsers] = useState(loadManagedUsers());
  const [selectedDistrict, setSelectedDistrict] = useState('andijon-shahar');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedLogin, setSelectedLogin] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('inspektor');
  const [newPassword, setNewPassword] = useState('');
  const [changePassword, setChangePassword] = useState('');

  useEffect(() => {
    saveManagedUsers(managedUsers);
  }, [managedUsers]);

  const users = useMemo(() => getMergedUsers(selectedDistrict, managedUsers), [selectedDistrict, managedUsers]);
  const usernames = useMemo(() => Object.keys(users).sort((a, b) => {
    const ra = users[a]?.role === 'admin' ? 0 : 1;
    const rb = users[b]?.role === 'admin' ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  }), [users]);

  const selectedInfo = selectedUser ? users[selectedUser] : null;
  const isManaged = selectedUser && ((managedUsers[selectedDistrict] || {}).hasOwnProperty(selectedUser));

  useEffect(() => {
    setSelectedLogin(selectedUser || '');
    setSelectedName(selectedInfo?.name || '');
    setChangePassword('');
  }, [selectedUser, selectedInfo]);

  function setDistrict(value) {
    setSelectedDistrict(value);
    setSelectedUser(null);
    setSelectedLogin('');
    setSelectedName('');
    setChangePassword('');
  }

  function updateManagedUser(username, entry) {
    setManagedUsers(prev => {
      const next = { ...prev };
      const districtMap = { ...(next[selectedDistrict] || {}) };
      districtMap[username] = entry;
      next[selectedDistrict] = districtMap;
      return next;
    });
  }

  function renameManagedUser(oldUsername, newUsername, entry) {
    setManagedUsers(prev => {
      const next = { ...prev };
      const districtMap = { ...(next[selectedDistrict] || {}) };

      if (oldUsername && oldUsername !== newUsername) {
        if (USERS[selectedDistrict] && USERS[selectedDistrict][oldUsername]) {
          districtMap[oldUsername] = null;
        } else {
          delete districtMap[oldUsername];
        }
      }

      districtMap[newUsername] = entry;
      next[selectedDistrict] = districtMap;
      return next;
    });
  }

  function removeUser(username) {
    if (!username) return;
    if (!window.confirm(`${username} foydalanuvchisini o'chirishni tasdiqlaysizmi?`)) return;

    setManagedUsers(prev => {
      const next = { ...prev };
      const districtMap = { ...(next[selectedDistrict] || {}) };
      if (USERS[selectedDistrict] && USERS[selectedDistrict][username]) {
        districtMap[username] = null;
      } else {
        delete districtMap[username];
      }
      if (Object.keys(districtMap).length === 0) {
        delete next[selectedDistrict];
      } else {
        next[selectedDistrict] = districtMap;
      }
      return next;
    });
    if (selectedUser === username) {
      setSelectedUser(null);
      setChangePassword('');
    }
  }

  function addUser() {
    const username = (newUsername || '').trim().toLowerCase();
    const name = (newName || '').trim();
    const password = (newPassword || '').trim();

    if (!username || !password) {
      alert('Login va parolni kiriting.');
      return;
    }
    if (username === 'master') {
      alert('"master" nomli foydalanuvchi band. Boshqa login tanlang.');
      return;
    }

    const entry = {
      username,
      pass: password,
      role: newRole === 'admin' ? 'admin' : 'inspektor',
      name: name || `${districtNameById(selectedDistrict)} ${newRole === 'admin' ? 'boshliq' : 'Inspektor'}`,
      district: selectedDistrict
    };

    updateManagedUser(username, entry);
    setNewUsername('');
    setNewName('');
    setNewPassword('');
    setSelectedUser(username);
    setSelectedLogin(username);
  }

  function updatePassword() {
    if (!selectedUser) {
      alert('Avval foydalanuvchini tanlang.');
      return;
    }
    const login = (selectedLogin || '').trim().toLowerCase();
    const password = (changePassword || '').trim();
    if (!login) {
      alert('Loginni kiriting.');
      return;
    }

    const current = users[selectedUser];
    if (!current) {
      alert('Foydalanuvchi topilmadi.');
      return;
    }

    const entry = {
      ...current,
      username: login,
      name: selectedName || current.name,
      pass: password || current.pass,
      district: selectedDistrict
    };

    renameManagedUser(selectedUser, login, entry);
    setSelectedUser(login);
    setSelectedLogin(login);
    setChangePassword('');
    alert('Login, ism va parol o‘zgartirildi.');
  }

  return (
    <AppLayout
      brandSub="Master paneli"
      navItems={[{ key: 'master', label: 'Master boshqaruvi', icon: 'fa-solid fa-user-shield' }]}
      active="master"
      onNav={() => {}}
      userName="Master"
      onLogout={logout}
    >
      <div className="page-head">
        <div>
          <h1>Master boshqaruvi</h1>
          <p>Tuman tanlab, admin va inspektorlarni qo'shish, o'chirish va parollarini o'zgartirish.</p>
        </div>
      </div>

      <div className="card-grid">
        <Card title="Tuman tanlash" icon="fa-solid fa-city">
          <Field label="Tuman">
            <select className="input" value={selectedDistrict} onChange={e => setDistrict(e.target.value)}>
              {DISTRICTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </Card>

        <Card title="Foydalanuvchilar" icon="fa-solid fa-users" count={`${usernames.length} ta`}>
          <div style={{ display: 'grid', gap: 10 }}>
            {usernames.length === 0 && <div style={{ color: '#94a3b8' }}>Bu tumanga hech qanday foydalanuvchi yo‘q.</div>}
            {usernames.map(username => {
              const info = users[username];
              const source = (managedUsers[selectedDistrict] || {}).hasOwnProperty(username) ? 'Sozlangan' : 'Asl';
              return (
                <div key={username} className="card-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{username} <span style={{ fontSize: 12, color: '#94a3b8' }}>({info.role})</span></div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{info.name || ''} • {source}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(username); setSelectedLogin(username); setChangePassword(''); }}>Tahrir</Button>
                    <Button variant="ghost" size="sm" className="btn-danger" onClick={() => removeUser(username)}>O'chirish</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="card-grid">
        <Card title="Yangi foydalanuvchi" icon="fa-solid fa-user-plus">
          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Login">
              <input className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="masalan: ishchi9" />
            </Field>
            <Field label="Roli">
              <select className="input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="inspektor">Inspektor</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Ismi">
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Masalan: Ahmad" />
            </Field>
            <Field label="Parol">
              <input className="input" type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Parol" />
            </Field>
            <Button block onClick={addUser}>Foydalanuvchini qo'shish</Button>
          </div>
        </Card>

        <Card title="Tanlangan foydalanuvchini yangilash" icon="fa-solid fa-key">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ color: '#94a3b8', marginBottom: 6 }}>{selectedUser ? `Tanlangan: ${selectedUser}` : 'Hech kim tanlanmagan'}</div>
            <Field label="Login">
              <input className="input" value={selectedLogin} onChange={e => setSelectedLogin(e.target.value)} placeholder="Login" disabled={!selectedUser} />
            </Field>
            <Field label="Foydalanuvchi ismi">
              <input className="input" type="text" value={selectedName} onChange={e => setSelectedName(e.target.value)} placeholder="Ism familiya" disabled={!selectedUser} />
            </Field>
            <Field label="Yangi parol">
              <input className="input" type="text" value={changePassword} onChange={e => setChangePassword(e.target.value)} placeholder="Yangi parol" disabled={!selectedUser} />
            </Field>
            <Button block onClick={updatePassword} disabled={!selectedUser}>Login, ism va parolni o'zgartirish</Button>
            {selectedUser && (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>
                Eslatma: bu o'zgartirish faqat shu brauzer va shu saqlash uchun amal qiladi.
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
