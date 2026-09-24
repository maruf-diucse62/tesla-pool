const fs = require('fs'), path = require('path'), db = require('./db');
(async () => {
  await db.query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
  const dir = path.join(__dirname, '../migrations');
  for (const f of fs.readdirSync(dir).sort()) {
    if ((await db.query('SELECT 1 FROM migrations WHERE name=$1', [f])).rowCount) continue;
    await db.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await db.query('INSERT INTO migrations VALUES ($1)', [f]);
    console.log('migrated', f);
  }
  await db.end();
})();
