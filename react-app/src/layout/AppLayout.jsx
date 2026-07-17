import { useState } from 'react';
import { useClock } from '../hooks.js';

export default function AppLayout({ brandSub, navItems, active, onNav, userName, userIcon, onLogout, children }) {
  const clock = useClock();
  const [open, setOpen] = useState(false);

  const initials = (userName || '?').trim().split(/[\s-]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-badge"><i className="fa-solid fa-shield-halved" /></div>
          <div className="brand-text">
            <b>FVV Andijon</b>
            <span>{brandSub}</span>
          </div>
        </div>

        <div className="sidebar-section-label">Bo'limlar</div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${active === item.key ? 'active' : ''}`}
              onClick={() => { onNav(item.key); setOpen(false); }}
            >
              <i className={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">Andijon shahar FVV © 2026</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button className="btn btn-ghost btn-icon sidebar-toggle" onClick={() => setOpen(v => !v)}>
              <i className="fa-solid fa-bars" />
            </button>
            <div className="topbar-title">
              {navItems.find(n => n.key === active)?.label || 'Panel'}
              <small>{brandSub}</small>
            </div>
          </div>
          <div className="topbar-right">
            <span className="topbar-clock"><i className="fa-regular fa-clock" style={{ marginRight: 6 }} />{clock}</span>
            <div className="topbar-user">
              <span className="avatar">{initials}</span>
              <span className="hide-sm">{userName}</span>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onLogout} title="Chiqish">
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
