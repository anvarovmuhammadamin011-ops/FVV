import { useState } from 'react';
import { DISTRICTS } from '../constants.js';
import { load } from '../utils.js';
import { useApp } from '../AppContext.jsx';
import { Button, Field } from '../ui/index.jsx';

export default function LoginPage() {
  const { doLogin } = useApp();
  const [district, setDistrict] = useState(load('last_district', null) || 'andijon-shahar');
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  function showError(msg) { setError(msg); setTimeout(() => setError(''), 3000); }

  async function handleLogin() {
    if (!user.trim() || !pass.trim()) { showError('Login va parolni kiriting!'); return; }
    try { await doLogin(district, user, pass); }
    catch (err) { setPass(''); showError(err.message || "Noto'g'ri login yoki parol!"); }
  }

  function quick(type) {
    if (type === 'worker') { setUser('ishchi1'); setPass('122333'); }
    else if (type === 'master') { setUser('master'); setPass('Master_2012'); }
    else { setUser('admin'); setPass('111223'); }
  }

  return (
    <div className="auth">
      {/* CHAP — brend paneli (navy) */}
      <div className="auth-brand">
        <div className="auth-brand-top">
          <div className="auth-brand-badge"><i className="fa-solid fa-shield-halved" /></div>
          <div>
            <b>FVV Andijon</b>
            <span>Xonadon Monitoring Tizimi</span>
          </div>
        </div>

        <div className="auth-hero">
          <h2>Yong'in xavfsizligi nazorati — bir tizimda.</h2>
          <p>
            Inspektorlar, tumanlar va viloyat bo'yicha tekshiruvlarni real vaqtda
            kuzating, kamchiliklarni qayd eting va bartaraf etilishini nazorat qiling.
          </p>
          <ul className="auth-features">
            <li><i className="fa-solid fa-chart-line" /> Jonli statistika va vizual hisobotlar</li>
            <li><i className="fa-solid fa-house-circle-check" /> Xonadonlar va kamchiliklar monitoringi</li>
            <li><i className="fa-solid fa-ranking-star" /> Tuman va inspektorlar reytingi</li>
          </ul>
        </div>

        <div className="auth-brand-foot">Andijon shahar FVV © 2026</div>
      </div>

      {/* O'NG — kirish formasi */}
      <div className="auth-main">
        <div className="auth-form">
          <div className="login-badge"><i className="fa-solid fa-right-to-bracket" /></div>
          <h1>Tizimga <span>kirish</span></h1>
          <p className="login-sub">Hisob ma'lumotlaringizni kiriting</p>

          <div className="login-form">
            <Field label="Tuman">
              <div className="input-icon">
                <i className="fa-solid fa-location-dot" />
                <select className="input" style={{ paddingLeft: 42 }} value={district} onChange={e => setDistrict(e.target.value)}>
                  {DISTRICTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Foydalanuvchi">
              <div className="input-icon">
                <i className="fa-solid fa-user" />
                <input className="input" value={user} placeholder="Foydalanuvchi nomi" autoComplete="off"
                  onChange={e => setUser(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') document.getElementById('loginPass')?.focus(); }} />
              </div>
            </Field>
            <Field label="Parol">
              <div className="input-icon">
                <i className="fa-solid fa-lock" />
                <input id="loginPass" className="input" type="password" value={pass} placeholder="Parol"
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
              </div>
            </Field>

            {error && <div className="login-error">{error}</div>}

            <div className="login-quick">
              <Button variant="ghost" size="sm" onClick={() => quick('admin')}>Admin</Button>
              <Button variant="ghost" size="sm" onClick={() => quick('worker')}>Inspektor</Button>
              <Button variant="ghost" size="sm" onClick={() => quick('master')}>Master</Button>
            </div>

            <Button block icon="fa-solid fa-arrow-right-to-bracket" onClick={handleLogin}>Kirish</Button>
            <div className="login-hint">Admin: admin / 111223 &nbsp;•&nbsp; Inspektor: ishchi1..8 / 122333 &nbsp;•&nbsp; Master: master / Master_2012</div>
          </div>

          <div className="login-foot">Andijon shahar FVV © 2026</div>
        </div>
      </div>
    </div>
  );
}
