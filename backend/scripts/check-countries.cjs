// backend/scripts/check-countries.cjs
//#!/usr/bin/env node
const { Client } = require("pg");

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }

  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const c1 = await db.query("SELECT COUNT(*)::int AS n FROM public.countries");
    const c2 = await db.query("SELECT COUNT(*)::int AS n FROM public.country_dial_codes");
    const samp = await db.query(`
      SELECT iso2, name_en, default_dial, emoji_flag, region, subregion, currency_code
      FROM public.countries
      ORDER BY iso2
      LIMIT 10
    `);
    console.log("countries:", c1.rows[0].n);
    console.log("dial codes:", c2.rows[0].n);
    console.table(samp.rows);
  } finally {
    await db.end();
  }
})();
