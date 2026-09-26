'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Passenger from '../components/Passenger';
import Driver from '../components/Driver';

const EMPTY = { name: '', email: '', password: '' };
const DEMO = ['jashim@teslapool.bd', 'nusrat@teslapool.bd', 'rafiq@teslapool.bd', 'shirin@teslapool.bd'];
const noAutofill = { autoComplete: 'off', readOnly: true, onFocus: (e) => e.target.removeAttribute('readOnly') };

export default function Home() {
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [signup, setSignup] = useState(false);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { const s = sessionStorage.getItem('session'); if (s) setSession(JSON.parse(s)); }, []);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const s = await api(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body: form });
      sessionStorage.setItem('session', JSON.stringify(s)); setSession(s);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const switchMode = (toSignup) => { setSignup(toSignup); setForm(EMPTY); setErr(''); };
  const logout = () => { sessionStorage.clear(); setSession(null); setForm(EMPTY); };

  if (!session) return (
    <main>
      <div className="hero"><h1>🛺 Dhaka Tesla Pool</h1><p>Share a seat. Split the fare. Survive Dhaka traffic.</p></div>
      <div className="card">
        <div className="segment">
          <button type="button" className={!signup ? 'active' : ''} onClick={() => switchMode(false)}>Log in</button>
          <button type="button" className={signup ? 'active' : ''} onClick={() => switchMode(true)}>New passenger</button>
        </div>
        <form onSubmit={submit}>
          {signup && <div className="field"><label>Name</label>
            <input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>}
          <div className="field"><label>Email</label>
            <input {...noAutofill} placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label>Password</label>
            <input type="password" {...noAutofill} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <button disabled={busy} style={{ width: '100%' }}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
          {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
        </form>
        <p className="muted" style={{ marginTop: 16 }}>Demo accounts — password123</p>
        <div className="demo-list">{DEMO.map((e) => <span key={e}>{e}</span>)}</div>
      </div>
    </main>);

  return (
    <main>
      <div className="top"><h2>🛺 {session.user.name} <span className="tag">{session.user.role}</span></h2>
        <button className="alt" onClick={logout}>Log out</button></div>
      {session.user.role === 'driver' ? <Driver token={session.token} /> : <Passenger token={session.token} />}
    </main>);
}
