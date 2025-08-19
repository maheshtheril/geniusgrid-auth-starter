// src/db/pool.js
import pg from "pg";

const isProd = process.env.NODE_ENV === "production";

// If your provider sets PGSSLMODE, honor it. Otherwise default to SSL in prod.
const ssl =
  (process.env.PGSSLMODE && process.env.PGSSLMODE.toLowerCase() === "disable")
    ? false
    : (isProd ? { rejectUnauthorized: false } : false);
// ↑ `rejectUnauthorized: false` is the pragmatic option when you don't have a CA bundle.
//   If your provider gives a CA cert, prefer:
//   const ssl = isProd ? { ca: process.env.DATABASE_CA } : false;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: Number(process.env.PG_MAX || 10),
  idleTimeoutMillis: 30_000,
});

export async function withClient(fn) {
  const client = await pool.connect();
  try { return await fn(client); } finally { client.release(); }
}
