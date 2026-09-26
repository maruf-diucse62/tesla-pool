'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Passenger from '../components/Passenger';
import Driver from '../components/Driver';

const DEMO = ['jashim', 'nusrat', 'rafiq', 'shirin'];
export default function Home() {
  const [session, setSession] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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
  const logout = () => { sessionStorage.clear(); setSession(null); setForm({ name: '', email: '', password: '' }); };

  if (!session) return (
    <main><div className="hero"><h1>🛺 Dhaka Tesla Pool</h1><p>Share a seat. Split the fare. Survive Dhaka traffic.</p></div>
      <form className="card" onSubmit={submit}>
        {signup && <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" autoComplete="off" readOnly onFocus={(e) => e.target.removeAttribute('readOnly')} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button disabled={busy}>{busy ? 'Please wait…' : signup ? 'Sign up' : 'Log in'}</button>
        <button type="button" className="alt" onClick={() => setSignup(!signup)}>{signup ? 'I have an account' : 'New passenger'}</button>
        {err && <p className="err">{err}</p>}
        <p className="muted">Demo (password123):{' '}
          {DEMO.map((n) => <button type="button" className="chip" key={n} onClick={() => setForm({ ...form, email: `${n}@teslapool.bd` })}>{n}</button>)}</p>
      </form></main>);

  return (
    <main><div className="top"><h2>🛺 {session.user.name} <span className="tag">{session.user.role}</span></h2><button className="alt" onClick={logout}>Log out</button></div>
      {session.user.role === 'driver' ? <Driver token={session.token} /> : <Passenger token={session.token} />}</main>);
}
