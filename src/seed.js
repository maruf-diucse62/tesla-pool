const bcrypt = require('bcryptjs'), db = require('./db');
// Zones sit on one imaginary "corridor" out of Banani. pos_km = km from Banani. Distance = |a - b|.
const ZONES = [['Banani',0],['Mohakhali',2],['Gulshan 1',3],['Farmgate',4],['Bashundhara',8],['Dhanmondi',9],['Mirpur',10],['Uttara',12]];
async function seed() {
  if ((await db.query('SELECT 1 FROM users LIMIT 1')).rowCount) return console.log('already seeded');
  for (const [n, p] of ZONES) await db.query('INSERT INTO zones(name,pos_km) VALUES ($1,$2)', [n, p]);
  const hash = await bcrypt.hash('password123', 8);
  const mk = async (name, email, role) => (await db.query(
    'INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id', [name, email, hash, role])).rows[0].id;
  const jashim = await mk('Jashim', 'jashim@teslapool.bd', 'driver');
  await mk('Nusrat', 'nusrat@teslapool.bd', 'passenger');
  await mk('Rafiq', 'rafiq@teslapool.bd', 'passenger');
  await mk('Shirin', 'shirin@teslapool.bd', 'passenger');
  await db.query("INSERT INTO vehicles(driver_id,name,capacity) VALUES ($1,'Bullet',3)", [jashim]);
  console.log('seeded: password for everyone is password123');
}
if (require.main === module) seed().then(() => db.end()); else module.exports = seed;
