// src/routes/meta.routes.js
import express from "express";
import { pool } from "../db/pool.js";
const router = express.Router();

router.get("/countries", async (req, res) => {
  const { active = "1", locale = "en" } = req.query;
  try {
    const sql = `
      with base as (
        select c.id, c.iso2, c.iso3,
               coalesce(t.name, c.name_en) as name,
               c.emoji_flag, c.default_dial,
               c.sort_order
        from countries c
        left join country_translations t
          on t.country_id = c.id and t.locale = $1
        where ($2::boolean is false) or (c.is_active = true)
      ),
      codes as (
        select country_id, json_agg(json_build_object('dial', dial_code, 'primary', is_primary) order by is_primary desc, dial_code) as dial_codes
        from country_dial_codes
        group by country_id
      )
      select b.*, coalesce(codes.dial_codes, '[]'::json) as dial_codes
      from base b
      left join codes on codes.country_id = b.id
      order by b.sort_order, b.name;
    `;
    const q = await pool.query(sql, [locale, active !== "0"]);
    res.json(q.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load countries" });
  }
});

export default router;
