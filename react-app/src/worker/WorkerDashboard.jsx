import { PageHeader, Stat, Card, Segmented, Progress, Button } from '../ui/index.jsx';
import { LineChart, BarChart, DonutChart, navy } from '../ui/charts.jsx';
import { todayStr, fmtDate, countResolvedChecks, isResolvedCheck } from '../utils.js';

export default function WorkerDashboard({ w, go }) {
  const today = todayStr();
  const goal = w.getGoal();
  const all = w.getAllWorkerChecks();
  const latest = w.getLatestDate();

  const visible = w.viewMode === 'all' ? all : w.getWorkerChecks(w.selectedDate || today);
  const stats = calc(visible);
  const todayChecks = w.getWorkerChecks(today);
  const todayDone = countResolvedChecks(todayChecks);
  const pct = goal ? Math.min(100, Math.round((todayDone / goal.count) * 100)) : 0;

  // 14 kunlik trend
  const days = buildDays(14, latest);
  const trendLabels = days.map(d => fmtDate(d).slice(0, 5));
  const checkedSeries = days.map(d => w.getWorkerChecks(d).length);
  const faultSeries = days.map(d => w.getWorkerChecks(d).filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.faultCount || 0), 0));

  const openKamchilik = visible.filter(c => c.status === 'kamchilik' && !isResolvedCheck(c)).length;

  return (
    <>
      <PageHeader
        title="Boshqaruv paneli"
        subtitle={`${w.workerName} — umumiy ko'rsatkichlar`}
        actions={
          <>
            <Segmented
              value={w.viewMode}
              onChange={w.setViewMode}
              options={[{ value: 'date', label: 'Tanlangan kun' }, { value: 'all', label: 'Barcha' }]}
            />
            <input type="date" className="input input-date" value={w.selectedDate} disabled={w.viewMode === 'all'}
              onChange={e => { w.setSelectedDate(e.target.value || today); w.setViewMode('date'); }} />
            <Button icon="fa-solid fa-plus" onClick={() => go('new-check')}>Yangi qayd</Button>
          </>
        }
      />

      <div className="grid grid-4">
        <Stat filled label="Maqsad" value={goal ? goal.count : '—'} icon="fa-solid fa-bullseye" sub={goal ? `${goal.mahalla}` : 'Maqsad yo\'q'} />
        <Stat label="Tekshirildi" value={stats.done} icon="fa-solid fa-circle-check" />
        <Stat label="Tavsiya berilgan" value={stats.kamchilik} icon="fa-solid fa-triangle-exclamation" />
        <Stat label="Bartaraf etildi" value={stats.bartaraf} icon="fa-solid fa-check-double" />
      </div>

      {goal && (
        <Card title="Faol maqsad" icon="fa-solid fa-flag" count={`${todayDone}/${goal.count}`} bodyClass="">
          <Progress value={pct} label={goal.mahalla} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            {todayDone >= goal.count ? (
              <span><i className="fa-solid fa-trophy" style={{ marginRight: 8 }} />Maqsad bajarildi!</span>
            ) : (
              <span className="cell-muted">Davom etmoqda...</span>
            )}
            <Button variant="ghost" size="sm" onClick={async () => { await w.newGoal(); go('new-check'); }}>Keyingi mahallaga o'tish</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-2 mt-20">
        <Card title="Oxirgi 14 kunlik faollik" icon="fa-solid fa-chart-line">
          <LineChart
            labels={trendLabels}
            series={[
              { label: 'Tekshirilgan xonadonlar', data: checkedSeries },
              { label: 'Tavsiya berilgan', data: faultSeries }
            ]}
          />
        </Card>
        <Card title="Holat taqsimoti" icon="fa-solid fa-chart-pie">
          {stats.total === 0
            ? <div className="chart-empty">Ma'lumot yo'q</div>
            : <DonutChart labels={['Tekshirildi', 'Ochiq kamchilik']} data={[stats.done, openKamchilik]} height="tall" />}
        </Card>
      </div>

      <Card title="Ko'rsatkichlar taqsimoti" icon="fa-solid fa-chart-column">
        {stats.total === 0
          ? <div className="chart-empty">Ma'lumot yo'q</div>
          : <BarChart
              labels={['Tekshirildi', 'Kamchilik', 'Bartaraf', 'Qoldi']}
              data={[stats.done, stats.kamchilik, stats.bartaraf, stats.qolgan]}
              perBarColor
              height="sm"
            />}
      </Card>
    </>
  );
}

function calc(checks) {
  const kamchilik = checks.filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.faultCount || 0), 0);
  const bartaraf = checks.filter(c => c.status === 'kamchilik').reduce((s, c) => s + (c.bartarafCount || 0), 0);
  return { total: checks.length, done: countResolvedChecks(checks), kamchilik, bartaraf, qolgan: Math.max(0, kamchilik - bartaraf) };
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
