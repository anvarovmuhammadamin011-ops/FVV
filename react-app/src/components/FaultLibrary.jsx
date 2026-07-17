import { useState, useMemo } from 'react';
import { Button, SearchInput } from '../ui/index.jsx';

export default function FaultLibrary({ faultTypes, selectedFaults, onToggle, onCreate }) {
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faultTypes;
    return faultTypes.filter(f => f.title.toLowerCase().includes(q));
  }, [search, faultTypes]);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    const newFault = await onCreate(title);
    if (newFault) {
      setIsCreating(false);
      setNewTitle('');
      onToggle(newFault);
    }
  }

  function isSelected(fault) {
    return selectedFaults.some(f => f.id === fault.id);
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>
          <i className="fa-solid fa-book" style={{ marginRight: 8 }} />
          Umumiy kamchiliklar bazasi
        </div>
        {!isCreating && (
          <Button variant="ghost" size="sm" icon="fa-solid fa-plus" onClick={() => setIsCreating(true)}>
            Yangi qo'shish
          </Button>
        )}
      </div>

      {isCreating ? (
        <div style={{ background: 'var(--paper)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
            Yangi kamchilik qo'shish (Barcha inspektorlarga ko'rinadi)
          </div>
          <div className="row">
            <input 
              className="input" 
              autoFocus
              value={newTitle} 
              placeholder="Masalan: Gaz o'chog'i nosozligi" 
              onChange={e => setNewTitle(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }}
            />
            <Button size="sm" onClick={handleCreate}>Saqlash</Button>
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>Bekor</Button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Kamchilik nomini qidiring..." />
        </div>
      )}

      {!isCreating && (
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: 13 }}>
              {search ? 'Bunday kamchilik topilmadi' : "Hozircha kamchiliklar bazasi bo'sh"}
            </div>
          ) : (
            filtered.map(f => {
              const selected = isSelected(f);
              return (
                <div 
                  key={f.id} 
                  className="row" 
                  style={{ 
                    padding: '10px 12px', 
                    background: selected ? 'var(--accent-light)' : 'var(--paper)', 
                    borderRadius: 8, 
                    cursor: 'pointer',
                    border: selected ? '1px solid var(--accent)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => onToggle(f)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = selected ? 'var(--accent)' : 'var(--line-strong)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = selected ? 'var(--accent)' : 'transparent'}
                >
                  <div style={{ 
                    width: 20, 
                    height: 20, 
                    borderRadius: 4, 
                    border: selected ? '2px solid var(--accent)' : '2px solid var(--line)',
                    background: selected ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    {selected && <i className="fa-solid fa-check" style={{ color: '#ffffff', fontSize: 12 }} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: selected ? 'var(--accent)' : 'var(--muted)' }}>
                    {selected ? 'Tanlangan' : 'Tanlash'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
