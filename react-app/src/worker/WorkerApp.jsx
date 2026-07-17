import { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import AppLayout from '../layout/AppLayout.jsx';
import { useWorker } from './useWorker.js';
import WorkerDashboard from './WorkerDashboard.jsx';
import NewCheck from './NewCheck.jsx';
import History from './History.jsx';

const NAV = [
  { key: 'dashboard', label: 'Boshqaruv', icon: 'fa-solid fa-gauge-high' },
  { key: 'new-check', label: 'Yangi qayd', icon: 'fa-solid fa-plus' },
  { key: 'history', label: 'Qaydlar tarixi', icon: 'fa-solid fa-list-check' }
];

export default function WorkerApp() {
  const { logout } = useApp();
  const w = useWorker();
  const [section, setSection] = useState('dashboard');
  const go = (s) => setSection(s);

  return (
    <AppLayout
      brandSub="Inspektor paneli"
      navItems={NAV}
      active={section}
      onNav={setSection}
      userName={w.workerName}
      onLogout={logout}
    >
      {section === 'dashboard' && <WorkerDashboard w={w} go={go} />}
      {section === 'new-check' && <NewCheck w={w} go={go} />}
      {section === 'history' && <History w={w} go={go} />}
    </AppLayout>
  );
}
