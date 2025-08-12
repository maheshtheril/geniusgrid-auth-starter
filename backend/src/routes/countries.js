import { Router } from "express";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const router = Router();

router.get("/", async (req, res) => {
  const locale = (req.query.locale || "en").toString();
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.iso2::text,
        c.iso3::text,
        COALESCE(ct.name, c.name_en) AS name,
        COALESCE(
          (SELECT cd.dial_code FROM public.country_dial_codes cd
           WHERE cd.country_id = c.id AND cd.is_primary = true LIMIT 1),
          c.default_dial
        ) AS default_dial,
        c.emoji_flag,
        c.region, c.subregion, c.currency_code
      FROM public.countries c
      LEFT JOIN public.country_translations ct
        ON ct.country_id = c.id AND ct.locale = $1
      WHERE c.is_active = true
      ORDER BY c.sort_order NULLS LAST, c.name_en
    `, [locale]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load countries" });
  }
});

export default router;
