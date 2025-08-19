// src/db/pool.js
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

function pgConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === 'false' || process.env.DATABASE_SSL === '0'
          ? false
          : { rejectUnauthorized: false },
    };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl:
      process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1'
        ? { rejectUnauthorized: false }
        : false,
  };
}

export const pool = new Pool(pgConfig());
