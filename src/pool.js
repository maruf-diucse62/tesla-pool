// Business rules live here (not in routes) so they are easy to find, test and explain.
const { fare } = require('./fare');
const err = (status, message) => Object.assign(new Error(message), { status });
const MAX_DEST_GAP_KM = 2; // MATCHING RULE: same pickup zone AND destinations within 2 km of each other

const compatible = (a, b) => a.pickup_zone_id === b.pickup_zone_id && Math.abs(a.dest_pos - b.dest_pos) <= MAX_DEST_GAP_KM;
const km = (r) => Math.abs(r.dest_pos - r.pickup_pos);

async function log(c, requestId, poolId, from, to, actor) {
  await c.query('INSERT INTO ride_events(request_id,pool_id,from_status,to_status,actor_id) VALUES ($1,$2,$3,$4,$5)', [requestId, poolId, from, to, actor]);
}
const REQ_SQL = `SELECT r.*, pz.pos_km AS pickup_pos, dz.pos_km::float AS dest_pos, pz.name AS pickup_name, dz.name AS dest_name
  FROM ride_requests r JOIN zones pz ON pz.id=r.pickup_zone_id JOIN zones dz ON dz.id=r.dest_zone_id`;
const loadReq = async (c, id, lock) => (await c.query(`${REQ_SQL} WHERE r.id=$1 ${lock ? 'FOR UPDATE OF r' : ''}`, [id])).rows[0];

// THE CONCURRENCY SPOT: we lock the Tesla's row first. Two people fighting for Bullet's last seat
// are forced into a line: the second one waits, then sees the seat is gone and gets a 409.
async function assign(c, requestId, vehicleId, actorId) {
  const v = (await c.query('SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [vehicleId])).rows[0];
  if (!v || !v.is_online) throw err(409, 'Tesla is offline');
  const r = await loadReq(c, requestId, true);
  if (!r || r.status !== 'REQUESTED') throw err(409, 'Request is no longer available');
  let p = (await c.query("SELECT * FROM pools WHERE vehicle_id=$1 AND status IN ('ACCEPTED','DRIVER_ARRIVED','STARTED')", [vehicleId])).rows[0];
  if (p && p.status !== 'ACCEPTED') throw err(409, 'Tesla already picked up / on the way');
  if (p) {
    const members = (await c.query(`${REQ_SQL} WHERE r.pool_id=$1 AND r.status<>'CANCELLED'`, [p.id])).rows;
    const used = members.reduce((s, m) => s + m.seats, 0);
    if (used + r.seats > v.capacity) throw err(409, `Not enough seats (${v.capacity - used} left)`);
    if (!members.every((m) => compatible(m, r))) throw err(409, 'Route not compatible with this pool');
  } else {
    if (r.seats > v.capacity) throw err(409, 'Not enough seats');
    p = (await c.query("INSERT INTO pools(vehicle_id,status) VALUES ($1,'ACCEPTED') RETURNING *", [vehicleId])).rows[0];
  }
  await c.query("UPDATE ride_requests SET status='MATCHED', pool_id=$2 WHERE id=$1", [requestId, p.id]);
  await log(c, requestId, p.id, 'REQUESTED', 'MATCHED', actorId);
  return p;
}

// After a passenger asks, try to hop into an already-accepted pool that fits (this is "sharing").
async function autoMatch(c, requestId, actorId) {
  const open = await c.query("SELECT p.vehicle_id FROM pools p JOIN vehicles v ON v.id=p.vehicle_id WHERE p.status='ACCEPTED' AND v.is_online");
  for (const { vehicle_id } of open.rows) {
    try { return await assign(c, requestId, vehicle_id, actorId); } catch (e) { if (e.status !== 409) throw e; }
  }
  return null;
}

const NEXT = { arrive: ['ACCEPTED', 'DRIVER_ARRIVED'], start: ['DRIVER_ARRIVED', 'STARTED'], complete: ['STARTED', 'COMPLETED'] };
async function advance(c, vehicleId, action, actorId) {
  await c.query('SELECT 1 FROM vehicles WHERE id=$1 FOR UPDATE', [vehicleId]);
  const p = (await c.query("SELECT * FROM pools WHERE vehicle_id=$1 AND status IN ('ACCEPTED','DRIVER_ARRIVED','STARTED')", [vehicleId])).rows[0];
  if (!p) throw err(404, 'No live pool');
  const [from, to] = NEXT[action];
  if (p.status !== from) throw err(409, `Cannot ${action}: pool is ${p.status}, must be ${from}`);
  const members = (await c.query(`${REQ_SQL} WHERE r.pool_id=$1 AND r.status<>'CANCELLED'`, [p.id])).rows;
  const pooled = members.length > 1; // final fare is locked in when the trip starts
  for (const m of members) {
    const f = action === 'start' ? fare(km(m), m.seats, pooled).total : m.fare_paisa;
    await c.query('UPDATE ride_requests SET status=$2, fare_paisa=$3 WHERE id=$1', [m.id, to, f]);
    await log(c, m.id, p.id, m.status, to, actorId);
  }
  await c.query('UPDATE pools SET status=$2 WHERE id=$1', [p.id, to]);
  return { pool_id: p.id, status: to };
}

async function cancel(c, requestId, passengerId) {
  let r = await loadReq(c, requestId, false);
  if (!r || r.passenger_id !== passengerId) throw err(404, 'Ride not found'); // never reveal others' rides
  if (r.pool_id) await c.query('SELECT 1 FROM vehicles v JOIN pools p ON p.vehicle_id=v.id WHERE p.id=$1 FOR UPDATE OF v', [r.pool_id]);
  r = await loadReq(c, requestId, true);
  if (!['REQUESTED', 'MATCHED'].includes(r.status)) throw err(409, `Cannot cancel a ride that is ${r.status}`);
  await c.query("UPDATE ride_requests SET status='CANCELLED' WHERE id=$1", [requestId]);
  await log(c, requestId, r.pool_id, r.status, 'CANCELLED', passengerId);
  if (r.pool_id) {
    const left = await c.query("SELECT 1 FROM ride_requests WHERE pool_id=$1 AND status<>'CANCELLED'", [r.pool_id]);
    if (!left.rowCount) await c.query("UPDATE pools SET status='CANCELLED' WHERE id=$1", [r.pool_id]);
  }
}
module.exports = { assign, autoMatch, advance, cancel, loadReq, REQ_SQL, km, err };
