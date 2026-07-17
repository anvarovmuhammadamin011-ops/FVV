// =====================================================================
// Reusable UI primitivlari (oq + navy dizayn tizimi)
// =====================================================================
import { useEffect } from 'react';

export function Button({ variant = 'primary', size, icon, block, children, className = '', ...rest }) {
  const cls = [
    'btn',
    variant === 'ghost' ? 'btn-ghost' : 'btn-primary',
    size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    className
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon && <i className={icon} />}
      {children}
    </button>
  );
}

export function Card({ title, icon, count, actions, bodyClass = '', children, noBody = false }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-head">
          {icon && <i className={icon} />}
          {title && <h2>{title}</h2>}
          {count != null && <span className="count">{count}</span>}
          {actions && <div className="row spacer" style={{ justifyContent: 'flex-end' }}>{actions}</div>}
        </div>
      )}
      {noBody ? children : <div className={`card-body ${bodyClass}`}>{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, filled }) {
  return (
    <div className={`stat ${filled ? 'filled' : ''}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon"><i className={icon} /></span>}
      </div>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map(opt => (
        <button
          key={opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="input-icon">
      <i className="fa-solid fa-magnifying-glass" />
      <input className="input" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

export function Badge({ children, variant = '' }) {
  return <span className={`badge ${variant}`}>{children}</span>;
}

export function EmptyState({ icon = 'fa-solid fa-inbox', children }) {
  return (
    <div className="empty">
      <i className={icon} />
      <span>{children}</span>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <button className="drawer-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Progress({ value, label, right }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div>
      {(label || right) && (
        <div className="progress-row">
          <span>{label}</span>
          <span>{right ?? `${pct}%`}</span>
        </div>
      )}
      <div className="progress"><div style={{ width: pct + '%' }} /></div>
    </div>
  );
}
