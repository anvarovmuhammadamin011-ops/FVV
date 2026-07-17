import { useState } from 'react';
import { PageHeader, Card, Drawer, Progress } from '../ui/index.jsx';
import { BarChart } from '../ui/charts.jsx';
import AdminViewControls from './AdminViewControls.jsx';
import CheckTable from '../components/CheckTable.jsx';
import CheckDetailDrawer from '../components/CheckDetailDrawer.jsx';
import { calc } from './useAdmin.js';
import { DISTRICTS } from '../constants.js';

export default function Districts({ a }) {
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);

  const stats = DISTRICTS.filter(d => d.scope === 'district').map(district => {
    const checks = a.viewChecks.filter(c => c.district === district.id);
    const c = calc(checks);
    const completionRate = checks.length > 0 ? (c.done / checks.length * 100) : 0;
    const ratingScore = Math.round(completionRate * 0.7 + (c.workers * 10) * 0.3);
    return { district, checks, ...c, completionRate, ratingScore };
  }).sort((x, y) => y.ratingScore - x.ratingScore);

  return (
    <>
      <PageHeader title="Tumanlar reytingi" subtitle="Tuman kartasini bosib tafsilotlarni ko'ring" actions={<AdminViewControls a={a} />} />

      <div className="grid grid-auto">
        {stats.map((ds, i) => (
          <div className={`rank-card ${i === 0 ? 'top' : ''}`} key={ds.district.id} onClick={() => setOpen(ds)}>
            <div className="rank-card-head">
              <div className="rank-no">{i + 1}</div>
              <div>
                <div className="rank-name">{ds.district.name}</div>
                <div className="rank-meta">{ds.workers} ta inspektor • {ds.total} ta qayd</div>
              </div>
              <div className="rank-score"><b>{ds.ratingScore}</b><span>Reyting</span></div>
            </div>
            <div className="mini-stats">
              <div className="mini-stat"><b>{ds.done}</b><span>Tekshirildi</span></div>
              <div className="mini-stat"><b>{ds.kamchilik}</b><span>Kamchilik</span></div>
              <div className="mini-stat"><b>{ds.bartaraf}</b><span>Bartaraf</span></div>
              <div className="mini-stat"><b>{ds.qolgan}</b><span>Qoldi</span></div>
            </div>
            <div className="mt-16"><Progress value={ds.completionRate} label="Bajarilish" right={`${ds.completionRate.toFixed(0)}%`} /></div>
          </div>
        ))}
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.district.name} subtitle={`Reyting: ${open?.ratingScore} • ${open?.total} ta qayd`}>
        {open && (
          <>
            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi"><b>{open.done}</b><span>Tekshirildi</span></div>
              <div className="kpi"><b>{open.kamchilik}</b><span>Kamchilik</span></div>
              <div className="kpi"><b>{open.bartaraf}</b><span>Bartaraf</span></div>
              <div className="kpi"><b>{open.qolgan}</b><span>Qoldi</span></div>
            </div>
            <div className="section-title mt-20">Ko'rsatkichlar</div>
            <BarChart labels={['Tekshirildi', 'Kamchilik', 'Bartaraf', 'Qoldi']} data={[open.done, open.kamchilik, open.bartaraf, open.qolgan]} perBarColor height="sm" />
            <div className="section-title mt-20">Tekshiruvlar ({open.checks.length})</div>
            <CheckTable checks={open.checks} onRowClick={setDetail} showInspector emptyText="Tekshiruv yo'q" />
          </>
        )}
      </Drawer>

      <CheckDetailDrawer check={detail} onClose={() => setDetail(null)} />
    </>
  );
}
