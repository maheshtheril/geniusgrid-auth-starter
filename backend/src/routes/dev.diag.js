import express from "express";
import { pool } from "../db/pool.js";
const router = express.Router();

router.get("/diag", async (_req, res) => {
  try {
    const { rows: db } = await pool.query("SELECT current_database() AS db");
    let tenants = 0, users = 0, tenantCodes = [];
    try {
      tenants = Number((await pool.query("SELECT COUNT(*) FROM tenants")).rows[0].count);
      tenantCodes = (await pool.query("SELECT code FROM tenants ORDER BY code LIMIT 5")).rows.map(r => r.code);
    } catch {}
    try {
      users = Number((await pool.query("SELECT COUNT(*) FROM res_users")).rows[0].count);
    } catch {}
    res.json({ ok:true, db: db[0].db, counts: { tenants, users }, tenantCodes });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
});

export default router;
