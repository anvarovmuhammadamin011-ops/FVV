import { useMemo, useState } from 'react';
import { PageHeader, Card, SearchInput } from '../ui/index.jsx';
import AdminViewControls from './AdminViewControls.jsx';
import CheckTable from '../components/CheckTable.jsx';
import CheckDetailDrawer from '../components/CheckDetailDrawer.jsx';
import { fmtDate } from '../utils.js';

export default function Checks({ a }) {
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return a.viewChecks;
    return a.viewChecks.filter(c =>
      (c.owner || '').toLowerCase().includes(q) ||
      (c.mahalla || '').toLowerCase().includes(q) ||
      (c.street || '').toLowerCase().includes(q) ||
      (c.house || '').toLowerCase().includes(q) ||
      (c.workerName || c.worker || '').toLowerCase().includes(q) ||
      (c.faultNote || '').toLowerCase().includes(q)
    );
  }, [search, a.viewChecks]);

  let titleSub;
  if (a.viewMode === 'all') titleSub = 'Barcha davr';
  else if (a.viewMode === 'range') titleSub = `${a.startDate} — ${a.endDate}`;
  else titleSub = fmtDate(a.requestedDate);

  return (
    <>
      <PageHeader
        title="Qaydlar"
        subtitle={`${a.scopeLabel} • qatorni bosib batafsil ko'ring`}
        actions={<AdminViewControls a={a} />}
      />

      <Card title={`Tekshiruvlar — ${titleSub}`} icon="fa-solid fa-list-check" count={`${filtered.length} ta`} noBody>
        <div style={{ padding: '16px 22px 0' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Qidiruv: ism, mahalla, ko'cha, uy, inspektor..." />
        </div>
        <div style={{ padding: 16 }}>
          <CheckTable
            checks={filtered}
            onRowClick={setDetail}
            showInspector
            emptyText={search.trim() ? `"${search.trim()}" bo'yicha natija topilmadi` : 'Tekshiruv topilmadi'}
          />
        </div>
      </Card>

      <CheckDetailDrawer check={detail} onClose={() => setDetail(null)} />
    </>
  );
}
