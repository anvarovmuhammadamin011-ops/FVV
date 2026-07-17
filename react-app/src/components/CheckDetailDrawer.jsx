import { useApp } from '../AppContext.jsx';
import { Drawer, Badge, Button } from '../ui/index.jsx';
import { fmtDate, fmtTime, isResolvedCheck, getCheckPhotos } from '../utils.js';

export default function CheckDetailDrawer({ check, onClose, onEdit }) {
  const { openPhotoModal } = useApp();
  if (!check) return null;

  const photos = getCheckPhotos(check);
  const isKamchilik = check.status === 'kamchilik';
  const resolved = isResolvedCheck(check);
  const qolgan = Math.max(0, (check.faultCount || 0) - (check.bartarafCount || 0));

  return (
    <Drawer open={!!check} onClose={onClose} title={`Uy ${check.house}`} subtitle={`${check.mahalla || '-'} • ${check.street || '-'}`}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <Badge variant={resolved ? 'solid' : ''}>{resolved ? 'Tekshirildi' : 'Kamchilik'}</Badge>
        {onEdit && <Button variant="ghost" size="sm" icon="fa-solid fa-pen-to-square" onClick={() => onEdit(check)}>Tahrirlash</Button>}
      </div>

      {photos.length > 0 ? (
        <div className="detail-banner" onClick={() => openPhotoModal(photos, 0)}>
          <img src={photos[0]} alt="" />
        </div>
      ) : (
        <div className="note-block" style={{ borderLeftColor: 'var(--line)', color: 'var(--muted)' }}>
          <i className="fa-solid fa-image" style={{ marginRight: 8 }} />Rasm yuklanmagan
        </div>
      )}

      <div className="detail-grid" style={{ marginTop: photos.length ? 0 : 16 }}>
        <Cell k="Uy egasi" v={check.owner || '—'} />
        <Cell k="Uy raqami" v={check.house} />
        <Cell k="Sana" v={`${fmtDate(check.date)}${check.time ? ' ' + fmtTime(check.time) : ''}`} />
        <Cell k="Inspektor" v={check.workerName || check.worker} />
        <Cell k="Mahalla" v={check.mahalla || '-'} />
        <Cell k="Ko'cha" v={check.street || '-'} />
      </div>

      {isKamchilik && (
        <div className="kpi-row">
          <div className="kpi"><b>{check.faultCount || 0}</b><span>Tavsiya berilgan</span></div>
          <div className="kpi"><b>{check.bartarafCount || 0}</b><span>Bartaraf etildi</span></div>
          <div className="kpi"><b>{qolgan}</b><span>Qoldi</span></div>
        </div>
      )}

      {isKamchilik && (
        <div className="note-block" style={!check.faultNote ? { borderLeftColor: 'var(--line)', color: 'var(--muted)' } : {}}>
          <i className="fa-solid fa-pen" style={{ marginRight: 8 }} />
          {check.faultNote || 'Izoh kiritilmagan'}
        </div>
      )}

      {photos.length > 1 && (
        <>
          <div className="section-title" style={{ marginTop: 20 }}>Barcha rasmlar ({photos.length})</div>
          <div className="detail-photos">
            {photos.map((src, i) => (
              <img key={i} src={src} alt="" onClick={() => openPhotoModal(photos, i)} />
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

function Cell({ k, v }) {
  return (
    <div className="detail-cell">
      <div className="k">{k}</div>
      <div className="v">{v || '—'}</div>
    </div>
  );
}
