import { PageHeader, Stat, Card } from '../ui/index.jsx';
import { LineChart, DonutChart, BarChart } from '../ui/charts.jsx';
import AdminViewControls from './AdminViewControls.jsx';
import { calc } from './useAdmin.js';
import { getMergedUsers } from '../AppContext.jsx';
import { DISTRICTS } from '../constants.js';
import { fmtDate, isResolvedCheck } from '../utils.js';

export default function Overview({ a }) {
  const s = calc(a.viewChecks);
  const openKamchilik = a.viewChecks.filter(c => c.status === 'kamchilik' && !isResolvedCheck(c)).length;

  // 14 kunlik trend
  const days = buildDays(14, a.requestedDate);
  const labels = days.map(d => fmtDate(d).slice(0, 5));
  const checkedSeries = days.map(d => a.getChecksForDate(d).length);
  const faultSeries = days.map(d => a.getChecksForDate(d).filter(c => c.status === 'kamchilik').reduce((acc, c) => acc + (c.faultCount || 0), 0));

  // Taqqoslama ustun: region → tumanlar, tuman → inspektorlar
  const breakdown = a.scope === 'region' ? districtBreakdown(a) : inspectorBreakdown(a);

  let titleSub;
  if (a.viewMode === 'all') titleSub = 'Barcha davr';
  else if (a.viewMode === 'range') titleSub = `${a.startDate} — ${a.endDate}`;
  else titleSub = fmtDate(a.requestedDate);

  return (
    <>
      <PageHeader
        title="Umumiy ko'rsatkichlar"
        subtitle={`${a.scopeLabel} • ${titleSub}`}
        actions={<AdminViewControls a={a} />}
      />

      <div className="grid grid-4">
        <Stat filled label="Tekshirildi" value={s.total} icon="fa-solid fa-house-circle-check" />
        <Stat label="Tavsiya berilgan" value={s.kamchilik} icon="fa-solid fa-triangle-exclamation" />
        <Stat label="Bartaraf etildi" value={s.bartaraf} icon="fa-solid fa-check-double" />
        <Stat label="Kamchilik qoldi" value={s.qolgan} icon="fa-solid fa-circle-exclamation" />
      </div>
      <div className="grid grid-2 mt-16">
        <Stat label="Faol inspektorlar" value={s.workers} icon="fa-solid fa-user-group" />
        <Stat filled label="Kamchiligi yo'q xonadon" value={s.done} icon="fa-solid fa-check-circle" />
      </div>

      <div className="grid grid-2 mt-20">
        <Card title="Oxirgi 14 kunlik faollik" icon="fa-solid fa-chart-line">
          <LineChart
            labels={labels}
            series={[
              { label: 'Tekshirilgan xonadonlar', data: checkedSeries },
              { label: 'Tavsiya berilgan', data: faultSeries }
            ]}
          />
        </Card>
        <Card title="Holat taqsimoti" icon="fa-solid fa-chart-pie">
          {s.total === 0
            ? <div className="chart-empty">Ma'lumot yo'q</div>
            : <DonutChart labels={['Tekshirildi', 'Ochiq kamchilik']} data={[s.done, openKamchilik]} height="tall" />}
        </Card>
      </div>

      <Card
        title={a.scope === 'region' ? 'Tumanlar bo\'yicha tekshiruvlar' : 'Inspektorlar bo\'yicha tekshiruvlar'}
        icon="fa-solid fa-chart-column"
      >
        {breakdown.labels.length === 0
          ? <div className="chart-empty">Ma'lumot yo'q</div>
          : <BarChart labels={breakdown.labels} data={breakdown.data} horizontal height="tall" />}
      </Card>
    </>
  );
}

function districtBreakdown(a) {
  const items = DISTRICTS.filter(d => d.scope === 'district').map(d => {
    const checks = a.viewChecks.filter(c => c.district === d.id);
    return { name: d.name, done: calc(checks).done };
  }).filter(x => x.done > 0).sort((x, y) => y.done - x.done).slice(0, 12);
  return { labels: items.map(i => i.name), data: items.map(i => i.done) };
}

function inspectorBreakdown(a) {
  const du = getMergedUsers(a.district);
  const inspectors = Object.keys(du).filter(u => du[u].role === 'inspektor' || du[u].role === 'worker');
  const items = inspectors.map(u => {
    const checks = a.viewChecks.filter(c => c.worker === u);
    return { name: du[u].name.replace(/^.*Inspektor/, 'Inspektor'), done: calc(checks).done };
  }).filter(x => x.done > 0).sort((x, y) => y.done - x.done);
  return { labels: items.map(i => i.name), data: items.map(i => i.done) };
}

function buildDays(n, endStr) {
  const end = new Date(`${endStr}T00:00:00`);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end); d.setDate(d.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}
