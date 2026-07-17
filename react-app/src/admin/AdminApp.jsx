import { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import AppLayout from '../layout/AppLayout.jsx';
import { useAdmin } from './useAdmin.js';
import Overview from './Overview.jsx';
import Checks from './Checks.jsx';
import Districts from './Districts.jsx';
import Inspectors from './Inspectors.jsx';
import Compare from './Compare.jsx';

export default function AdminApp() {
  const { logout } = useApp();
  const a = useAdmin();
  const [section, setSection] = useState('overview');

  const isRegion = a.scope === 'region';

  // "Tumanlar reytingi" faqat viloyat (region) panelida ko'rinadi.
  const nav = [
    { key: 'overview', label: 'Umumiy', icon: 'fa-solid fa-chart-pie' },
    { key: 'checks', label: 'Qaydlar', icon: 'fa-solid fa-list-check' },
    ...(isRegion ? [{ key: 'districts', label: 'Tumanlar reytingi', icon: 'fa-solid fa-trophy' }] : []),
    { key: 'inspectors', label: 'Inspektorlar', icon: 'fa-solid fa-user-group' },
    { key: 'compare', label: 'Solishtirish', icon: 'fa-solid fa-scale-balanced' }
  ];

  return (
    <AppLayout
      brandSub={a.scope === 'region' ? 'Viloyat paneli' : 'Admin paneli'}
      navItems={nav}
      active={section}
      onNav={setSection}
      userName={a.scopeLabel}
      onLogout={logout}
    >
      {section === 'overview' && <Overview a={a} />}
      {section === 'checks' && <Checks a={a} />}
      {section === 'districts' && isRegion && <Districts a={a} />}
      {section === 'inspectors' && <Inspectors a={a} />}
      {section === 'compare' && <Compare a={a} />}
    </AppLayout>
  );
}
