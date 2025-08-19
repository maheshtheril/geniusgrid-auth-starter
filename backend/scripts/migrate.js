// backend/scripts/migrate.js
import 'dotenv/config';

// Skip locally unless explicitly enabled
const enabled = ['1','true','yes','on'].includes(String(process.env.RUN_MIGRATIONS||'').toLowerCase());
if (!enabled) {
  console.log('↩︎ Migrations disabled (RUN_MIGRATIONS=0). Skipping.');
  process.exit(0);
}

// (Runs on Render or when you enable it)
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render PG requires TLS
});

(async () => {
  try {
    await pool.query('SELECT NOW()'); // sanity ping
    console.log('✅ DB reachable. Running migrations…');
    // TODO: call your real migration runner here
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed', e);
    process.exit(1);
  }
})();
