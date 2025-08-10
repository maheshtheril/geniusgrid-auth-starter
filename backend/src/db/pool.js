import pg from "pg";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // or { user, host, database, password, port, ssl }
  max: 20,
});
