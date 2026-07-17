import { PageHeader, Card, Field, Button } from '../ui/index.jsx';
import { fmtDate } from '../utils.js';
import FaultLibrary from '../components/FaultLibrary.jsx';

export default function NewCheck({ w, go }) {
  const goal = w.getGoal();
  const isEditing = w.editingCheckId !== null;
  const editingCheck = isEditing ? w.getAllWorkerChecks().find(i => String(i.id) === String(w.editingCheckId)) : null;

  async function submit() {
    const ok = await w.addCheck();
    if (ok) go('history');
  }

  // Maqsad yo'q va tahrir emas → maqsad qo'yish formasi
  if (!goal && !isEditing) {
    return (
      <>
        <PageHeader title="Yangi qayd" subtitle="Avval tekshiruv maqsadini belgilang" />
        <Card title="Maqsad qo'yish" icon="fa-solid fa-flag">
          <div style={{ maxWidth: 260 }}>
            <Field label="Mahalla">
              <input className="input" value={w.goalMahalla} placeholder="Masalan: Bog'ishamol" onChange={e => w.setGoalMahalla(e.target.value)} />
            </Field>
          </div>
          <div style={{ maxWidth: 260, marginTop: 16 }}>
            <Field label="Xonadon soni (maqsad)">
              <input className="input" type="number" min="1" value={w.goalCount} placeholder="Masalan: 40" onChange={e => w.setGoalCount(e.target.value)} />
            </Field>
          </div>
          <Button className="mt-16" icon="fa-solid fa-plus" onClick={w.setGoal}>Maqsad qo'y</Button>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isEditing ? 'Qaydni tahrirlash' : 'Yangi qayd'}
        subtitle={goal ? `${goal.mahalla} • ${goal.count} xonadon` : (editingCheck ? `${editingCheck.mahalla || '-'} • ${fmtDate(editingCheck.date)}` : '')}
        actions={!isEditing && goal && (
          <Button variant="ghost" size="sm" onClick={() => go('dashboard')}>Boshqaruvga qaytish</Button>
        )}
      />

      {isEditing && (
        <Card>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>Tahrirlash rejimi</strong>
              <div className="cell-muted">{editingCheck ? `Uy ${editingCheck.house} — ${editingCheck.owner}` : 'Qayd tahrirlanmoqda'}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { w.resetForm(); go('history'); }}>Bekor qilish</Button>
          </div>
        </Card>
      )}

      <Card title="Tekshiruv ma'lumotlari" icon="fa-solid fa-clipboard-check">
        <div className="form-grid">
          <Field label="Uy raqami">
            <input className="input" value={w.house} placeholder="Masalan: 12A" onChange={e => w.setHouse(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </Field>
          <Field label="Uy egasining ismi">
            <input className="input" value={w.owner} placeholder="Masalan: Aliyev Jasur" onChange={e => w.setOwner(e.target.value)} />
          </Field>
        </div>

        <div className="mt-16">
          <Field label="Holat">
            <select className="select" value={w.status} onChange={e => w.setStatus(e.target.value)}>
              <option value="tekshirildi">Tekshirildi</option>
              <option value="kamchilik">Tavsiya berilgan</option>
            </select>
          </Field>
        </div>

        {w.status === 'kamchilik' && (
          <div className="mt-16" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
            <div className="section-title"><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />Tavsiya berilgan ma'lumotlar</div>
            
            <FaultLibrary 
              faultTypes={w.faultTypes}
              selectedFaults={w.selectedFaults}
              onCreate={w.createFaultType}
              onToggle={(f) => {
                const exists = w.selectedFaults.some(sf => sf.id === f.id);
                let newSelected;
                if (exists) {
                  newSelected = w.selectedFaults.filter(sf => sf.id !== f.id);
                  w.setSelectedFaults(newSelected);
                  w.setResolvedFaults(w.resolvedFaults.filter(rf => rf.id !== f.id));
                } else {
                  newSelected = [...w.selectedFaults, f];
                  w.setSelectedFaults(newSelected);
                }
                if (newSelected.length > 0 && (w.faultCount === '0' || !w.faultCount)) {
                  w.setFaultCount(String(newSelected.length));
                }
                // Auto-generate faultNote
                if (newSelected.length > 0) {
                  const selectedTitles = newSelected.map(sf => sf.title).join(', ');
                  const resolvedTitles = w.resolvedFaults
                    .filter(rf => newSelected.some(sf => sf.id === rf.id))
                    .map(rf => rf.title).join(', ');
                  w.setFaultNote(
                    resolvedTitles 
                      ? `Tavsiya berilgan: ${selectedTitles}. Bartaraf etildi: ${resolvedTitles}`
                      : `Tavsiya berilgan: ${selectedTitles}`
                  );
                } else {
                  w.setFaultNote('');
                }
              }}
            />

            {w.selectedFaults.length > 0 && (
              <div className="mt-16" style={{ background: 'var(--paper)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
                  Tanlangan kamchiliklar ({w.selectedFaults.length} ta):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {w.selectedFaults.map(f => {
                    const isResolved = w.resolvedFaults.some(rf => rf.id === f.id);
                    return (
                      <div key={f.id} className="row" style={{ 
                        padding: '8px 12px', 
                        background: isResolved ? 'var(--success-light)' : 'var(--accent-light)', 
                        borderRadius: 6,
                        border: isResolved ? '1px solid var(--success)' : '1px solid var(--accent)'
                      }}>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0c1f3f' }}>{f.title}</div>
                        <button 
                          type="button"
                          className="btn-small"
                          style={{ 
                            background: isResolved ? 'var(--success)' : 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: 4,
                            fontSize: 12,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            let newResolved;
                            if (isResolved) {
                              newResolved = w.resolvedFaults.filter(rf => rf.id !== f.id);
                              w.setResolvedFaults(newResolved);
                            } else {
                              newResolved = [...w.resolvedFaults, f];
                              w.setResolvedFaults(newResolved);
                            }
                            w.setBartarafCount(String(newResolved.length));
                            // Auto-update faultNote
                            const selectedTitles = w.selectedFaults.map(sf => sf.title).join(', ');
                            const resolvedTitles = newResolved.map(rf => rf.title).join(', ');
                            w.setFaultNote(
                              resolvedTitles 
                                ? `Tavsiya berilgan: ${selectedTitles}. Bartaraf etildi: ${resolvedTitles}`
                                : `Tavsiya berilgan: ${selectedTitles}`
                            );
                          }}
                        >
                          {isResolved ? '✓ Bartaraf qilindi' : 'Bartaraf qilish'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-grid mt-16">
              <Field label="Tavsiya berilgan soni">
                <input className="input" type="number" min="1" value={w.selectedFaults.length || w.faultCount} readOnly style={{ background: 'var(--paper)' }} />
              </Field>
              <Field label="Bartaraf etilgan soni">
                <input className="input" type="number" min="0" value={w.resolvedFaults.length || w.bartarafCount} readOnly style={{ background: 'var(--paper)' }} />
              </Field>
            </div>
            <div className="mt-16">
              <Field label="Izoh (majburiy)">
                <textarea className="textarea" rows="3" value={w.faultNote} placeholder="Tavsiya haqida qisqa izoh" onChange={e => w.setFaultNote(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        <div className="mt-16">
          <Field label="Isbot rasmlari (ixtiyoriy)">
            <label className="btn btn-ghost" style={{ width: 'fit-content' }}>
              <i className="fa-solid fa-camera" />
              {w.pendingPhotos.length ? `${w.pendingPhotos.length} ta rasm tanlandi` : 'Rasm tanlang'}
              <input ref={w.fileInputRef} type="file" accept="image/*" multiple onChange={w.previewPhoto} style={{ display: 'none' }} />
            </label>
          </Field>
          {w.pendingPhotos.length > 0 && (
            <>
              <div className="detail-photos" style={{ marginTop: 12 }}>
                {w.pendingPhotos.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt="" onClick={() => w.openPhotoModal(w.pendingPhotos, i)} />
                    <button type="button" className="drawer-close" style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, fontSize: 12 }}
                      onClick={() => w.removePhoto(i)}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="mt-16" icon="fa-solid fa-xmark" onClick={() => w.removePhoto()}>Rasmlarni tozalash</Button>
            </>
          )}
        </div>

        <div className="row mt-20">
          <Button icon={isEditing ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-clipboard-check'} onClick={submit}>
            {isEditing ? 'Tahrirni saqlash' : 'Qayd qil'}
          </Button>
          {isEditing && <Button variant="ghost" onClick={() => { w.resetForm(); go('history'); }}>Bekor qilish</Button>}
        </div>
      </Card>
    </>
  );
}
