const express = require('express'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const db = require('./db');
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

app.use((e, _q, res, _n) => { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); });
module.exports = app;
