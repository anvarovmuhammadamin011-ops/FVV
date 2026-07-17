// =====================================================================
// Reusable grafiklar — monoxrom navy (qo'shimcha rang/gradiyent yo'q).
// Seriyalar navy ning shaffoflik darajalari bilan ajratiladi.
// =====================================================================
import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const NAVY = '15, 39, 71';
export const navy = (a = 1) => `rgba(${NAVY}, ${a})`;
// Bir nechta seriya uchun navy shaffoflik shkalasi
export const NAVY_SCALE = [navy(1), navy(0.55), navy(0.3), navy(0.16)];

const GRID = navy(0.08);
const TICK = navy(0.55);

const baseScales = (extra = {}) => ({
  x: { ticks: { color: TICK, font: { size: 11 } }, grid: { color: GRID }, ...(extra.x || {}) },
  y: {
    beginAtZero: true,
    ticks: { color: TICK, precision: 0, callback: v => (Number.isInteger(v) ? v : '') },
    grid: { color: GRID },
    ...(extra.y || {})
  }
});

function useChart(makeConfig, deps) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = new Chart(ref.current, makeConfig());
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function ChartLegend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((it, i) => (
        <div className="chart-legend-item" key={i}>
          <span className="chart-legend-dot" style={{ background: it.color }} />{it.label}
        </div>
      ))}
    </div>
  );
}

/* ---------- Line chart (ko'p seriyali trend) ---------- */
export function LineChart({ labels, series, height = 'tall' }) {
  const ref = useChart(() => ({
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: s.color || NAVY_SCALE[i],
        backgroundColor: navy(0.06),
        pointBackgroundColor: s.color || NAVY_SCALE[i],
        pointBorderColor: '#fff',
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: i === 0 ? 3 : 2,
        borderDash: i > 1 ? [5, 4] : [],
        fill: i === 0,
        tension: 0.35
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      interaction: { mode: 'nearest', intersect: false },
      scales: baseScales()
    }
  }), [labels, series]);

  return (
    <div className="chart-box">
      <div className={`chart-canvas-wrap ${height}`}><canvas ref={ref} /></div>
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: s.color || NAVY_SCALE[i] }))} />
    </div>
  );
}

/* ---------- Bar chart (taqsimot) ---------- */
export function BarChart({ labels, data, label = '', horizontal = false, perBarColor = false, height = 'tall' }) {
  const ref = useChart(() => ({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: perBarColor ? labels.map((_, i) => NAVY_SCALE[i % NAVY_SCALE.length]) : navy(0.85),
        borderColor: navy(1),
        borderWidth: 1,
        borderRadius: 6,
        maxBarThickness: 46
      }]
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { intersect: false } },
      scales: baseScales()
    }
  }), [labels, data, horizontal, perBarColor, label]);

  return <div className={`chart-canvas-wrap ${height}`}><canvas ref={ref} /></div>;
}

/* ---------- Grouped bar (ko'p seriyali ustunlar) ---------- */
export function GroupedBarChart({ labels, series, height = 'tall' }) {
  const ref = useChart(() => ({
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.data,
        backgroundColor: s.color || NAVY_SCALE[i],
        borderColor: navy(1),
        borderWidth: i === 0 ? 0 : 1,
        borderRadius: 5,
        maxBarThickness: 30
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: baseScales()
    }
  }), [labels, series]);

  return (
    <div className="chart-box">
      <div className={`chart-canvas-wrap ${height}`}><canvas ref={ref} /></div>
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: s.color || NAVY_SCALE[i] }))} />
    </div>
  );
}

/* ---------- Donut (holat taqsimoti) ---------- */
export function DonutChart({ labels, data, height = 'sm' }) {
  const ref = useChart(() => ({
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) => NAVY_SCALE[i % NAVY_SCALE.length]),
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      plugins: { legend: { display: false }, tooltip: { enabled: true } }
    }
  }), [labels, data]);

  return (
    <div className="chart-box">
      <div className={`chart-canvas-wrap ${height}`}><canvas ref={ref} /></div>
      <ChartLegend items={labels.map((l, i) => ({ label: `${l}: ${data[i]}`, color: NAVY_SCALE[i % NAVY_SCALE.length] }))} />
    </div>
  );
}
