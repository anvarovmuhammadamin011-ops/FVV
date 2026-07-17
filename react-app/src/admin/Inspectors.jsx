import { useMemo, useState } from 'react';
import { PageHeader, Drawer } from '../ui/index.jsx';
import { BarChart } from '../ui/charts.jsx';
import AdminViewControls from './AdminViewControls.jsx';
import CheckTable from '../components/CheckTable.jsx';
import CheckDetailDrawer from '../components/CheckDetailDrawer.jsx';
import { calc } from './useAdmin.js';
import { getMergedUsers } from '../AppContext.jsx';
import { DISTRICTS, districtNameById } from '../constants.js';

function buildInspectorStats(districtId, viewChecks) {
  const du = getMergedUsers(districtId);
  const inspectorIds = Object.keys(du).filter(u => du[u].role === 'inspektor' || du[u].role === 'worker');

  return inspectorIds.map(u => {
    const checks = viewChecks.filter(c => c.worker === u && c.district === districtId);
    return {
      id: `${districtId}:${u}`,
      worker: u,
      district: districtId,
      districtName: districtNameById(districtId),
      name: du[u].name,
      checks,
      ...calc(checks)
    };
  });
}

export default function Inspectors({ a }) {
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const isRegion = a.scope === 'region';

  const stats = useMemo(() => {
    const items = isRegion
      ? DISTRICTS.filter(d => d.scope === 'district').flatMap(d => buildInspectorStats(d.id, a.viewChecks))
      : buildInspectorStats(a.district, a.viewChecks);

    return items.sort((x, y) => y.done - x.done || x.districtName.localeCompare(y.districtName) || x.name.localeCompare(y.name));
  }, [isRegion, a.district, a.viewChecks]);

  return (
    <>
      <PageHeader
        title="Inspektorlar reytingi"
        subtitle={isRegion
          ? `Andijon viloyati • ${stats.length} ta inspektor • kartani bosib tafsilotni ko'ring`
          : `${districtNameById(a.district)} • kartani bosib tafsilotni ko'ring`}
        actions={<AdminViewControls a={a} />}
      />

      <div className="grid grid-auto">
        {stats.map((it, i) => (
          <div className={`rank-card ${i === 0 ? 'top' : ''}`} key={it.id} onClick={() => setOpen(it)}>
            <div className="rank-card-head">
              <div className="rank-no">{i + 1}</div>
              <div>
                <div className="rank-name">{it.name}</div>
                <div className="rank-meta">
                  {isRegion ? `${it.districtName} • ` : ''}{it.total} ta qayd
                </div>
              </div>
              <div className="rank-score"><b>{it.done}</b><span>Tekshirgan</span></div>
            </div>
            <div className="mini-stats">
              <div className="mini-stat"><b>{it.done}</b><span>Tekshirildi</span></div>
              <div className="mini-stat"><b>{it.kamchilik}</b><span>Kamchilik</span></div>
              <div className="mini-stat"><b>{it.bartaraf}</b><span>Bartaraf</span></div>
              <div className="mini-stat"><b>{it.qolgan}</b><span>Qoldi</span></div>
            </div>
          </div>
        ))}
      </div>

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        subtitle={open ? `${isRegion ? `${open.districtName} • ` : ''}${open.total} ta qayd` : ''}
      >
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
            <CheckTable checks={open.checks} onRowClick={setDetail} emptyText="Tekshiruv yo'q" />
          </>
        )}
      </Drawer>

      <CheckDetailDrawer check={detail} onClose={() => setDetail(null)} />
    </>
  );
}
