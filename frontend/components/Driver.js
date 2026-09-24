'use client';
import { useState, useEffect, useCallback } from 'react';
import { api, taka } from '../lib/api';
const NEXT = { ACCEPTED: ['arrive', 'Mark arrived'], DRIVER_ARRIVED: ['start', 'Start trip'], STARTED: ['complete', 'Complete trip'] };

export default function Driver({ token }) {
  const [online, setOnline] = useState(false);
  const [data, setData] = useState(null); // { pool, reqs, history }
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const [pool, reqs, history] = await Promise.all([api('/driver/pool', { token }), api('/driver/requests', { token }), api('/driver/history', { token })]); setData({ pool, reqs, history }); }
    catch (e) { setErr(e.message); }
  }, [token]);
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);
  const act = async (fn) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } finally { await load(); setBusy(false); } };

  if (!data) return <div className="card"><div className="skeleton" style={{width:'50%'}}/><div className="skeleton" style={{width:'80%'}}/><div className="skeleton" style={{width:'65%'}}/></div>;
  const { pool, reqs, history } = data; const step = pool.pool && NEXT[pool.pool.status];
  return (<>
    {err && <p className="err">{err}</p>}
    <div className="card"><button disabled={busy} onClick={() => act(async () => { await api('/driver/online', { method: 'POST', token, body: { online: !online } }); setOnline(!online); })}>{online ? 'Go offline' : 'Go online'}</button>
      <span className="tag">{online ? 'Online' : 'Offline'}</span></div>
    <div className="card"><h3>Current pool {pool.pool && <span className={'tag s-' + pool.pool.status}>{pool.pool.status}</span>}</h3>
      {!pool.pool ? <p className="muted">No passengers yet. Accept a request below.</p> : <>
        <div className="seats">{Array.from({ length: pool.capacity }).map((_, i) => <span key={i} className={'seat' + (i < pool.seats_used ? ' full' : '')} />)}<b>{pool.seats_used} / {pool.capacity} seats</b></div>
        {pool.members.map((m) => <div className="row" key={m.id}><span><b>{m.passenger}</b> → {m.destination} · {m.seats} seat(s)</span><span>{taka(m.fare_paisa)}</span></div>)}
        {step && <button disabled={busy} onClick={() => act(() => api(`/driver/pool/${step[0]}`, { method: 'POST', token }))}>{step[1]}</button>}</>}
    </div>
    <div className="card"><h3>Waiting requests</h3>
      {!online ? <p className="muted">Go online to see requests.</p> : reqs.length === 0 ? <p className="muted">No requests right now.</p> :
        reqs.map((r) => <div className="row" key={r.id}><span><b>{r.passenger}</b>: {r.pickup} → {r.destination} · {r.seats} seat(s)</span>
          <button disabled={busy} onClick={() => act(() => api(`/driver/requests/${r.id}/accept`, { method: 'POST', token }))}>Accept</button></div>)}
    </div>
    <div className="card"><h3>Trip history</h3>
      {history.length === 0 && <p className="muted">No trips yet.</p>}
      {history.map((h) => <div className="row" key={h.pool_id}><span>Pool #{h.pool_id} · {h.passengers} passenger(s) · {taka(+h.total_fare_paisa)}</span><span className={'tag s-' + h.status}>{h.status}</span></div>)}
    </div></>);
}
