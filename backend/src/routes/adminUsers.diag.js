import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

router.get("/api/admin/users/__diag", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId =
      req.session?.tenantId || req.session?.tenant_id || req.get("x-tenant-id");

    const reg = await client.query(`
      SELECT COALESCE(to_regclass('public.res_users')::text, '') AS res_users,
             COALESCE(to_regclass('public.users')::text, '')    AS users
    `);
    const table =
      reg.rows[0].res_users === "public.res_users" ? "res_users" :
      reg.rows[0].users === "public.users" ? "users" : null;

    let columns = [], hasTenantId = false, countAll = null, countTenant = null, sample = [];

    if (table) {
      const cols = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY 1
      `, [table]);
      columns = cols.rows.map(r => r.column_name);
      hasTenantId = columns.includes("tenant_id");

      const cAll = await client.query(`SELECT COUNT(*)::bigint AS n FROM ${table}`);
      countAll = Number(cAll.rows[0].n);

      if (hasTenantId && tenantId) {
        const cTen = await client.query(`SELECT COUNT(*)::bigint AS n FROM ${table} WHERE tenant_id=$1`, [tenantId]);
        countTenant = Number(cTen.rows[0].n);
        const s = await client.query(
          `SELECT id, email, ${columns.includes("name") ? "name" : "NULL::text AS name"}
           FROM ${table}
           WHERE tenant_id=$1
           ORDER BY id DESC
           LIMIT 3`,
          [tenantId]
        );
        sample = s.rows;
      } else {
        const s = await client.query(
          `SELECT id, email, ${columns.includes("name") ? "name" : "NULL::text AS name"}
           FROM ${table}
           ORDER BY id DESC
           LIMIT 3`
        );
        sample = s.rows;
      }
    }

    res.json({
      tableResolved: table,
      columns,
      hasTenantId,
      tenantIdUsed: tenantId || null,
      counts: { all: countAll, tenant: countTenant },
      sample,
    });
  } catch (err) {
    console.error("users diag failed:", err?.message || err);
    res.status(500).json({ error: err?.message || "diag failed" });
  } finally {
    client.release();
  }
});

export default router;
