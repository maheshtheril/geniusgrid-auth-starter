// src/routes/tenantMenus.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/**
 * GET /api/tenant/menus
 * Read-only. Seeds from tenant_menus, then includes ancestors.
 * Returns flat list your sidebar can nest by parent_id.
 */
router.get("/tenant/menus", async (req, res) => {
  const tenantId =
    req.session?.tenantId ??
    req.session?.tenant_id ??
    req.session?.user?.tenantId ??
    null;

  if (!tenantId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const sql = `
      WITH
      seeds AS (
        SELECT mt.id, mt.parent_id
        FROM public.menu_templates mt
        JOIN public.tenant_menus tm
          ON tm.menu_id = mt.id
         AND tm.tenant_id = $1
         AND COALESCE(tm.is_active, TRUE) = TRUE
      ),
      ancestors AS (
        SELECT s.id, s.parent_id, ARRAY[s.id] AS path
        FROM seeds s
        UNION ALL
        SELECT p.id, p.parent_id, a.path || p.id
        FROM public.menu_templates p
        JOIN ancestors a ON a.parent_id = p.id
        WHERE NOT (p.id = ANY(a.path))  -- cycle guard
      ),
      ids AS (
        SELECT DISTINCT id FROM ancestors
      )
      SELECT
        mt.id::text                 AS id,
        COALESCE(mt.label, mt.code) AS name,
        mt.path                     AS path,
        mt.icon                     AS icon,
        mt.parent_id::text          AS parent_id,
        mt.sort_order               AS sort_order
      FROM public.menu_templates mt
      JOIN ids ON ids.id = mt.id
      ORDER BY
        COALESCE(mt.parent_id::text, ''),
        COALESCE(mt.sort_order, 0),
        COALESCE(mt.label, mt.code);
    `;

    const { rows } = await pool.query(sql, [tenantId]);
    return res.json({ items: rows });
  } catch (err) {
    // logs full SQL error to server logs; client stays generic
    req.log?.error({ err }, "GET /api/tenant/menus failed");
    return res.status(500).json({ error: "Failed to load menus" });
  }
});

export default router;
