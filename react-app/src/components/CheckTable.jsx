import { Badge, EmptyState } from '../ui/index.jsx';
import { fmtDate, isResolvedCheck, getCheckPhotos } from '../utils.js';

export default function CheckTable({ checks, onRowClick, showInspector, emptyText = 'Tekshiruv topilmadi' }) {
  if (!checks.length) return <EmptyState icon="fa-solid fa-clipboard">{emptyText}</EmptyState>;

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Uy / Egasi</th>
            <th>Mahalla / Ko'cha</th>
            {showInspector && <th>Inspektor</th>}
            <th>Sana</th>
            <th className="tbl-num">Kamchilik</th>
            <th>Holat</th>
          </tr>
        </thead>
        <tbody>
          {checks.map(c => {
            const photos = getCheckPhotos(c);
            const resolved = isResolvedCheck(c);
            const qolgan = Math.max(0, (c.faultCount || 0) - (c.bartarafCount || 0));
            return (
              <tr key={c.id} onClick={() => onRowClick(c)}>
                <td>
                  <div className="cell-flex">
                    {photos[0]
                      ? <img className="thumb-xs" src={photos[0]} alt="" />
                      : <span className="thumb-ph"><i className="fa-solid fa-image" /></span>}
                    <div>
                      <div className="cell-strong">Uy {c.house}</div>
                      <div className="cell-muted">{c.owner}</div>
                    </div>
                  </div>
                </td>
                <td className="cell-muted">{c.mahalla || '-'}<br />{c.street || '-'}</td>
                {showInspector && <td className="cell-muted">{c.workerName || c.worker}</td>}
                <td className="cell-muted tbl-num">{fmtDate(c.date)}</td>
                <td className="tbl-num">
                  {c.status === 'kamchilik'
                    ? <span className="cell-strong">{c.faultCount || 0}{qolgan > 0 ? ` (${qolgan} qoldi)` : ''}</span>
                    : <span className="cell-muted">—</span>}
                </td>
                <td><Badge variant={resolved ? 'solid' : ''}>{resolved ? 'Tekshirildi' : 'Kamchilik'}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
