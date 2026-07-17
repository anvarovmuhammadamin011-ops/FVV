import { useState } from 'react';
import { PageHeader, Card, Field, Button } from '../ui/index.jsx';
import { GroupedBarChart } from '../ui/charts.jsx';
import { calc } from './useAdmin.js';
import { DISTRICTS } from '../constants.js';
import { fmtDate } from '../utils.js';

export default function Compare({ a }) {
  if (a.scope === 'region') return <RegionCompare a={a} />;
  return <DayCompare a={a} />;
}

// ---- Tuman: ikki kunni solishtirish ----
function DayCompare({ a }) {
  const [d1, setD1] = useState('');
  const [d2, setD2] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  function run() {
    setErr('');
    if (!d1 || !d2) { setErr('Iltimos ikki sanani tanlang!'); setRes(null); return; }
    if (d1 === d2) { setErr('Turli kunlarni tanlang!'); setRes(null); return; }
    const s1 = calc(a.getChecksForDate(d1));
    const s2 = calc(a.getChecksForDate(d2));
    setRes({ s1, s2, w: s1.done >= s2.done ? 1 : 2 });
  }

  return (
    <>
      <PageHeader title="Ikki kunni solishtirish" subtitle={a.scopeLabel} />
      <Card title="Sanalarni tanlang" icon="fa-solid fa-scale-balanced">
        <div className="form-grid">
          <Field label="1-kun"><input type="date" className="input" value={d1} onChange={e => setD1(e.target.value)} /></Field>
          <Field label="2-kun"><input type="date" className="input" value={d2} onChange={e => setD2(e.target.value)} /></Field>
        </div>
        <Button className="mt-16" icon="fa-solid fa-magnifying-glass-chart" onClick={run}>Taqqosla</Button>
        {err && <div className="login-error mt-16">{err}</div>}
      </Card>

      {res && (
        <>
          <div className="grid grid-2 mt-20">
            <DayColumn date={d1} s={res.s1} winner={res.w === 1} />
            <DayColumn date={d2} s={res.s2} winner={res.w === 2} />
          </div>
          <Card title="Vizual taqqoslash" icon="fa-solid fa-chart-column">
            <GroupedBarChart
              labels={['Tekshirildi', 'Kamchilik', 'Bartaraf', 'Qoldi']}
              series={[
                { label: fmtDate(d1), data: [res.s1.done, res.s1.kamchilik, res.s1.bartaraf, res.s1.qolgan] },
                { label: fmtDate(d2), data: [res.s2.done, res.s2.kamchilik, res.s2.bartaraf, res.s2.qolgan] }
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}

function DayColumn({ date, s, winner }) {
  return (
    <Card title={fmtDate(date)} icon="fa-regular fa-calendar" count={winner ? '🏆 G\'olib' : undefined}>
      <Row k="Qaydlar" v={s.total} />
      <Row k="Tekshirildi" v={s.done} />
      <Row k="Tavsiya berilgan" v={s.kamchilik} />
      <Row k="Bartaraf etildi" v={s.bartaraf} />
      <Row k="Qoldi" v={s.qolgan} />
      <Row k="Inspektorlar" v={s.workers} />
    </Card>
  );
}

// ---- Region: tumanlarni solishtirish ----
function RegionCompare({ a }) {
  const items = DISTRICTS.filter(d => d.scope === 'district').map(d => {
    const checks = a.viewChecks.filter(c => c.district === d.id);
    return { district: d, ...calc(checks) };
  }).sort((x, y) => y.done - x.done || y.total - x.total);

  const top = items.filter(i => i.total > 0).slice(0, 10);

  return (
    <>
      <PageHeader title="Tumanlar bo'yicha taqqoslash" subtitle="Andijon viloyati" />
      <Card title="Vizual taqqoslash (eng faol 10 tuman)" icon="fa-solid fa-chart-column">
        {top.length === 0
          ? <div className="chart-empty">Ma'lumot yo'q</div>
          : <GroupedBarChart
              labels={top.map(i => i.district.name)}
              series={[
                { label: 'Tekshirildi', data: top.map(i => i.done) },
                { label: 'Kamchilik', data: top.map(i => i.kamchilik) },
                { label: 'Bartaraf', data: top.map(i => i.bartaraf) }
              ]}
            />}
      </Card>

      <Card title="Tumanlar jadvali" icon="fa-solid fa-table-list" count={`${items.length} ta`} noBody>
        <div className="tbl-wrap" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Tuman</th><th className="tbl-num">Qaydlar</th><th className="tbl-num">Tekshirildi</th><th className="tbl-num">Kamchilik</th><th className="tbl-num">Bartaraf</th><th className="tbl-num">Qoldi</th></tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.district.id} style={{ cursor: 'default' }}>
                  <td>{i + 1}</td>
                  <td className="cell-strong">{it.district.name}</td>
                  <td className="tbl-num">{it.total}</td>
                  <td className="tbl-num">{it.done}</td>
                  <td className="tbl-num">{it.kamchilik}</td>
                  <td className="tbl-num">{it.bartaraf}</td>
                  <td className="tbl-num">{it.qolgan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Row({ k, v }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="cell-muted">{k}</span>
      <span className="cell-strong tbl-num">{v}</span>
    </div>
  );
}
