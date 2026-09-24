'use client';
import { useState, useEffect, useCallback } from 'react';
import { api, taka } from '../lib/api';
const LIVE = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'];
const STEPS = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED']; const SHORT = ['Waiting', 'Matched', 'Arrived', 'On the way'];
const LABEL = { REQUESTED: 'Waiting for a Tesla', MATCHED: 'Matched — Tesla is coming', DRIVER_ARRIVED: 'Tesla has arrived', STARTED: 'On the way', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export default function Passenger({ token }) {
  const [zones, setZones] = useState([]); const [rides, setRides] = useState(null);
  const [f, setF] = useState({ pickup: '', dest: '', seats: 1 }); const [est, setEst] = useState(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/rides', { token }).then(setRides).catch((e) => setErr(e.message)), [token]);
  useEffect(() => { api('/zones').then(setZones); load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    setEst(null);
    if (f.pickup && f.dest && f.pickup !== f.dest) api(`/rides/estimate?pickup=${f.pickup}&dest=${f.dest}&seats=${f.seats}`, { token }).then(setEst).catch(() => {});
  }, [f, token]);

  const act = async (fn) => { setBusy(true); setErr(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const request = () => act(() => api('/rides', { method: 'POST', token, body: { pickup_zone_id: +f.pickup, dest_zone_id: +f.dest, seats: +f.seats } }));
  const cancel = (id) => act(() => api(`/rides/${id}/cancel`, { method: 'POST', token }));

  if (!rides) return <div className="card"><div className="skeleton" style={{width:'60%'}}/><div className="skeleton" style={{width:'85%'}}/><div className="skeleton" style={{width:'40%'}}/></div>;
  const active = rides.find((r) => LIVE.includes(r.status));
  return (<>
    {err && <p className="err">{err}</p>}
    {active ? (
      <div className="card"><h3>Your ride <span className={'tag s-' + active.status}>{LABEL[active.status]}</span></h3>
        <div className="steps">{STEPS.map((s, i) => <div key={s} className={'step' + (i <= STEPS.indexOf(active.status) ? ' on' : '')}><span />{SHORT[i]}</div>)}</div>
        <p>{active.pickup} → {active.destination} · {active.seats} seat(s)</p>
        <p>Fare: <span className="price">{taka(active.fare_paisa)}</span> {active.fare_paisa == null && <span className="muted">(locked when the trip starts)</span>}</p>
        {active.tesla && <p>Tesla: {active.tesla}</p>}
        {['REQUESTED', 'MATCHED'].includes(active.status) && <button className="alt" disabled={busy} onClick={() => cancel(active.id)}>Cancel ride</button>}
      </div>
    ) : (
      <div className="card"><h3>Request a ride</h3>
        <select value={f.pickup} onChange={(e) => setF({ ...f, pickup: e.target.value })}><option value="">Pickup…</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        <select value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })}><option value="">Destination…</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select>
        <select value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })}>{[1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select>
        {est && <p>{est.km} km · alone <b>{taka(est.alone.total)}</b> · if shared <b>{taka(est.shared.total)}</b></p>}
        <button disabled={busy || !est} onClick={request}>Request ride</button></div>
    )}
    <div className="card"><h3>History</h3>
      {rides.filter((r) => !LIVE.includes(r.status)).length === 0 && <p className="muted">No past rides yet.</p>}
      {rides.filter((r) => !LIVE.includes(r.status)).map((r) => <div className="row" key={r.id}><span>{r.pickup} → {r.destination} · {taka(r.fare_paisa)}</span><span className={'tag s-' + r.status}>{r.status}</span></div>)}
    </div></>);
}
