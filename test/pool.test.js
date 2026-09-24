// Integration tests: need Postgres. Run:  DATABASE_URL=... npm test   (wipes & reseeds the DB!)
const test = require('node:test'), assert = require('node:assert');
const db = require('../src/db'), seed = require('../src/seed');
let base, T = {};
const call = async (who, method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(T[who] && { Authorization: 'Bearer ' + T[who] }) }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
test.before(async () => {
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await db.query(require('fs').readFileSync(__dirname + '/../migrations/001_init.sql', 'utf8'));
  await seed();
  const server = require('../src/app').listen(0); base = `http://localhost:${server.address().port}`;
  for (const n of ['jashim', 'nusrat', 'rafiq', 'shirin'])
    T[n] = (await call(null, 'POST', '/auth/login', { email: `${n}@teslapool.bd`, password: 'password123' })).body.token;
  await call('jashim', 'POST', '/driver/online', { online: true });
});
test.after(() => db.end().then(() => process.exit(0)));
const zone = async (name) => (await db.query('SELECT id FROM zones WHERE name=$1', [name])).rows[0].id;

test('pooling, fares, capacity, concurrency, ownership, transitions', async () => {
  const [ban, moh, gul] = [await zone('Banani'), await zone('Mohakhali'), await zone('Gulshan 1')];
  // Nusrat requests; Jashim accepts -> pool opens
  const n = (await call('nusrat', 'POST', '/rides', { pickup_zone_id: ban, dest_zone_id: moh, seats: 1 })).body;
  assert.strictEqual((await call('jashim', 'POST', `/driver/requests/${n.id}/accept`)).status, 200);
  // Rafiq (overlapping trip) auto-joins the same Bullet
  const r = (await call('rafiq', 'POST', '/rides', { pickup_zone_id: ban, dest_zone_id: gul, seats: 1 })).body;
  assert.strictEqual(r.status, 'MATCHED');
  // Bullet (3 seats): Nusrat + Rafiq = 2 used, 1 left. Now two people race for that last seat.
  const extra = (await call(null, 'POST', '/auth/signup', { name: 'Tania', email: 'tania@teslapool.bd', password: 'password123' })).body.token;
  T.tania = extra;
  const [s, t] = await Promise.all([
    call('shirin', 'POST', '/rides', { pickup_zone_id: ban, dest_zone_id: moh, seats: 1 }),
    call('tania', 'POST', '/rides', { pickup_zone_id: ban, dest_zone_id: moh, seats: 1 })]);
  const matched = [s, t].filter((x) => x.body.status === 'MATCHED').length;
  assert.strictEqual(matched, 1, 'exactly one of two racers gets the last seat');
  const pool = (await call('jashim', 'GET', '/driver/pool')).body;
  assert.ok(pool.seats_used <= pool.capacity && pool.seats_used === 3);
  // Ownership: Shirin cannot read or cancel Nusrat's ride
  assert.strictEqual((await call('shirin', 'GET', `/rides/${n.id}`)).status, 404);
  assert.strictEqual((await call('shirin', 'POST', `/rides/${n.id}/cancel`)).status, 404);
  // Invalid transitions rejected
  assert.strictEqual((await call('jashim', 'POST', '/driver/pool/start')).status, 409);
  assert.strictEqual((await call('jashim', 'POST', '/driver/pool/complete')).status, 409);
  await call('jashim', 'POST', '/driver/pool/arrive');
  await call('jashim', 'POST', '/driver/pool/start');
  // Fares locked at start: Nusrat ৳56, Rafiq ৳68; can't cancel once started
  assert.strictEqual((await call('nusrat', 'GET', `/rides/${n.id}`)).body.fare_paisa, 5600);
  assert.strictEqual((await call('rafiq', 'GET', `/rides/${r.id}`)).body.fare_paisa, 6800);
  assert.strictEqual((await call('nusrat', 'POST', `/rides/${n.id}/cancel`)).status, 409);
  assert.strictEqual((await call('jashim', 'POST', '/driver/pool/complete')).status, 200);
});
