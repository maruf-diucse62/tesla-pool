// const { Pool } = require('pg');
// module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
const { Pool } = require('pg');
// Local Docker Postgres has no SSL. Hosted providers (Neon, Supabase, Render Postgres)
// require it. DATABASE_SSL=true forces it on for any host; otherwise we auto-detect
// common managed hosts so local `docker compose up` keeps working unchanged.
const needsSSL = process.env.DATABASE_SSL === 'true'
  || /neon\.tech|supabase\.co|render\.com/.test(process.env.DATABASE_URL || '');
module.exports = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});