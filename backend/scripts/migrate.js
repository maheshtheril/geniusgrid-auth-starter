// backend/scripts/migrate.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '00_auth_core.sql'), 'utf8');

(async () => {
  try {
    await pool.query(sql);
    console.log('✅ Migration applied');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed', e);
    process.exit(1);
  }
})();
