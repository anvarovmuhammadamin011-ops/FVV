import { Segmented } from '../ui/index.jsx';
import { todayStr } from '../utils.js';

// Admin uchun ko'rinish boshqaruvi: Tanlangan kun / Oraliq / Barcha
export default function AdminViewControls({ a }) {
  return (
    <>
      <Segmented
        value={a.viewMode}
        onChange={a.setViewMode}
        options={[
          { value: 'date', label: 'Kun' },
          { value: 'range', label: 'Oraliq' },
          { value: 'all', label: 'Barcha' }
        ]}
      />
      {a.viewMode === 'range' ? (
        <div className="row">
          <input type="date" className="input input-date" value={a.startDate} onChange={e => a.setStartDate(e.target.value)} />
          <span className="cell-muted">—</span>
          <input type="date" className="input input-date" value={a.endDate} onChange={e => a.setEndDate(e.target.value)} />
        </div>
      ) : (
        <input
          type="date" className="input input-date" value={a.selectedDate} disabled={a.viewMode === 'all'}
          onChange={e => { a.setSelectedDate(e.target.value || todayStr()); a.setViewMode('date'); }}
        />
      )}
    </>
  );
}
