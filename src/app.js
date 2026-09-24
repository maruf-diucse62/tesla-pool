const express = require('express'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const db = require('./db'), { fare } = require('./fare'), P = require('./pool');
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const app = express(); app.use(express.json());
// CORS: lets the Next.js site (another port) call this API from the browser.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.WEB_ORIGIN || 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use((req, _r, next) => { console.log(new Date().toISOString(), req.method, req.url); next(); });

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
// Run a function inside one DB transaction: all-or-nothing.
async function tx(fn) {
  const c = await db.connect();
  try { await c.query('BEGIN'); const out = await fn(c); await c.query('COMMIT'); return out; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
const auth = (role) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); } catch { return res.status(401).json({ error: 'Login required' }); }
  if (role && req.user.role !== role) return res.status(403).json({ error: `Only ${role}s can do this` });
  next();
};

app.get('/health', (_q, res) => res.json({ ok: true }));
app.get('/zones', wrap(async (_q, res) => res.json((await db.query('SELECT id,name FROM zones ORDER BY pos_km')).rows)));

app.post('/auth/signup', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !/^\S+@\S+$/.test(email || '') || (password || '').length < 8) return res.status(400).json({ error: 'name, valid email, password (8+ chars) required' });
  try {
    const u = (await db.query("INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,'passenger') RETURNING id,name,role", [name, email, await bcrypt.hash(password, 10)])).rows[0];
    res.status(201).json({ token: jwt.sign(u, SECRET, { expiresIn: '8h' }), user: u });
  } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'Email already used' }); throw e; }
}));
app.post('/auth/login', wrap(async (req, res) => {
  const u = (await db.query('SELECT * FROM users WHERE email=$1', [req.body.email])).rows[0];
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) return res.status(401).json({ error: 'Wrong email or password' });
  const user = { id: u.id, name: u.name, role: u.role };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '8h' }), user });
}));

// ---------- Passenger ----------
async function estimate(pickup, dest, seats) {
  const z = (await db.query('SELECT id,pos_km::float FROM zones WHERE id = ANY($1)', [[pickup, dest]])).rows;
  if (pickup === dest || z.length !== 2 || !Number.isInteger(seats) || seats < 1 || seats > 3) throw P.err(400, 'Valid different pickup/destination zones and seats 1-3 required');
  const d = Math.abs(z[0].pos_km - z[1].pos_km);
  return { km: d, alone: fare(d, seats, false), shared: fare(d, seats, true) };
}
app.get('/rides/estimate', auth('passenger'), wrap(async (req, res) =>
  res.json(await estimate(+req.query.pickup, +req.query.dest, +req.query.seats))));

app.post('/rides', auth('passenger'), wrap(async (req, res) => {
  const { pickup_zone_id: pu, dest_zone_id: de, seats = 1, payment_method = 'CASH' } = req.body;
  await estimate(pu, de, seats);
  if (!['CASH', 'TESLAPAY'].includes(payment_method)) return res.status(400).json({ error: 'payment_method must be CASH or TESLAPAY' });
  const id = await tx(async (c) => {
    const busy = await c.query("SELECT 1 FROM ride_requests WHERE passenger_id=$1 AND status IN ('REQUESTED','MATCHED','DRIVER_ARRIVED','STARTED')", [req.user.id]);
    if (busy.rowCount) throw P.err(409, 'You already have an active ride');
    const r = (await c.query("INSERT INTO ride_requests(passenger_id,pickup_zone_id,dest_zone_id,seats,status,payment_method) VALUES ($1,$2,$3,$4,'REQUESTED',$5) RETURNING id", [req.user.id, pu, de, seats, payment_method])).rows[0];
    await c.query("INSERT INTO ride_events(request_id,to_status,actor_id) VALUES ($1,'REQUESTED',$2)", [r.id, req.user.id]);
    await P.autoMatch(c, r.id, req.user.id);
    return r.id;
  });
  res.status(201).json(await ride(id));
}));
// Passenger sees ONLY their own ride: no other passengers' names or fares are ever selected here.
const ride = async (id) => (await db.query(`SELECT r.id,r.status,r.seats,r.fare_paisa,r.payment_method,r.created_at,pz.name AS pickup,dz.name AS destination,v.name AS tesla
  FROM ride_requests r JOIN zones pz ON pz.id=r.pickup_zone_id JOIN zones dz ON dz.id=r.dest_zone_id
  LEFT JOIN pools p ON p.id=r.pool_id LEFT JOIN vehicles v ON v.id=p.vehicle_id WHERE r.id=$1`, [id])).rows[0];
app.get('/rides', auth('passenger'), wrap(async (req, res) => {
  const ids = (await db.query('SELECT id FROM ride_requests WHERE passenger_id=$1 ORDER BY id DESC', [req.user.id])).rows;
  res.json(await Promise.all(ids.map((r) => ride(r.id))));
}));
app.get('/rides/:id', auth('passenger'), wrap(async (req, res) => {
  const own = await db.query('SELECT 1 FROM ride_requests WHERE id=$1 AND passenger_id=$2', [req.params.id, req.user.id]);
  own.rowCount ? res.json(await ride(req.params.id)) : res.status(404).json({ error: 'Ride not found' });
}));
app.post('/rides/:id/cancel', auth('passenger'), wrap(async (req, res) => {
  await tx((c) => P.cancel(c, +req.params.id, req.user.id));
  res.json(await ride(req.params.id));
}));

app.use((e, _q, res, _n) => { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); });
module.exports = app;
