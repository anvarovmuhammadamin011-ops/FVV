import { useMemo, useState } from 'react';
import { PageHeader, Card, Segmented, SearchInput } from '../ui/index.jsx';
import CheckTable from '../components/CheckTable.jsx';
import CheckDetailDrawer from '../components/CheckDetailDrawer.jsx';
import { todayStr, fmtDate } from '../utils.js';

export default function History({ w, go }) {
  const [search, setSearch] = useState('');
  const [scopeMode, setScopeMode] = useState('mine');
  const [detail, setDetail] = useState(null);
  const today = todayStr();

  const visible = useMemo(() => {
    const allChecks = scopeMode === 'district' ? w.getAllDistrictChecks() : w.getAllWorkerChecks();
    return w.viewMode === 'all' ? allChecks : allChecks.filter(i => i.date === (w.selectedDate || today));
  }, [scopeMode, w, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(c =>
      (c.owner || '').toLowerCase().includes(q) ||
      (c.mahalla || '').toLowerCase().includes(q) ||
      (c.street || '').toLowerCase().includes(q) ||
      (c.house || '').toLowerCase().includes(q) ||
      (c.workerName || c.worker || '').toLowerCase().includes(q) ||
      (c.status || '').toLowerCase().includes(q) ||
      (c.faultNote || '').toLowerCase().includes(q) ||
      String(c.faultCount || '').includes(q) ||
      String(c.bartarafCount || '').includes(q)
    );
  }, [search, visible]);

  return (
    <>
      <PageHeader
        title="Qaydlar tarixi"
        subtitle="Qatorni bosib batafsil ko'ring"
        actions={
          <>
            <Segmented value={w.viewMode} onChange={w.setViewMode}
              options={[{ value: 'date', label: 'Tanlangan kun' }, { value: 'all', label: 'Barcha' }]} />
            <Segmented value={scopeMode} onChange={setScopeMode}
              options={[{ value: 'mine', label: 'Mening' }, { value: 'district', label: 'Barcha tuman' }]} />
            <input type="date" className="input input-date" value={w.selectedDate} disabled={w.viewMode === 'all'}
              onChange={e => { w.setSelectedDate(e.target.value || today); w.setViewMode('date'); }} />
          </>
        }
      />

      <Card
        title={w.viewMode === 'all' ? 'Barcha tekshiruvlar' : `${fmtDate(w.selectedDate || today)} tekshiruvlari`}
        icon="fa-solid fa-list-check"
        count={`${filtered.length} ta`}
        noBody
      >
        <div style={{ padding: '16px 22px 0' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Qidiruv: ism, mahalla, ko'cha, uy, kamchilik..." />
        </div>
        <div style={{ padding: 16 }}>
          <CheckTable
            checks={filtered}
            onRowClick={setDetail}
            emptyText={search.trim() ? `"${search.trim()}" bo'yicha natija topilmadi` : "Tekshiruv yo'q"}
          />
        </div>
      </Card>

      <CheckDetailDrawer
        check={detail}
        onClose={() => setDetail(null)}
        onEdit={(c) => { setDetail(null); w.startEdit(c); go('new-check'); }}
      />
    </>
  );
}
