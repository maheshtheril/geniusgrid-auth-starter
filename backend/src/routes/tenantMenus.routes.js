// src/routes/tenantMenus.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// Queries (two variants)
const QUERY_PARENT_ID = `
  SELECT
    mi.id::text                 AS id,
    COALESCE(mi.label, mi.code) AS name,
    mi.path                     AS path,
    mi.icon                     AS icon,
    mi.parent_id::text          AS parent_id,
    mi.sort_order               AS sort_order
  FROM public.menu_items mi
  LEFT JOIN public.tenant_modules tm
    ON tm.tenant_id   = mi.tenant_id
   AND tm.module_code = mi.module_code
   AND tm.status      = 'installed'
  WHERE mi.tenant_id  = $1
    AND mi.is_active  = true
    AND (mi.module_code IS NULL OR tm.module_code IS NOT NULL)
    AND (
      mi.permission_code IS NULL
      OR mi.permission_code = ''
      OR mi.permission_code = ANY ($2::text[])
    )
  ORDER BY
    COALESCE(mi.parent_id::text, ''),
    COALESCE(mi.sort_order, 0),
    COALESCE(mi.label, mi.code)
`;

const QUERY_PARENT_CODE = `
  SELECT
    mi.id::text                 AS id,
    COALESCE(mi.label, mi.code) AS name,
    mi.path                     AS path,
    mi.icon                     AS icon,
    mi.parent_code::text        AS parent_id,   -- alias as parent_id for the frontend
    mi.sort_order               AS sort_order
  FROM public.menu_items mi
  LEFT JOIN public.tenant_modules tm
    ON tm.tenant_id   = mi.tenant_id
   AND tm.module_code = mi.module_code
   AND tm.status      = 'installed'
  WHERE mi.tenant_id  = $1
    AND mi.is_active  = true
    AND (mi.module_code IS NULL OR tm.module_code IS NOT NULL)
    AND (
      mi.permission_code IS NULL
      OR mi.permission_code = ''
      OR mi.permission_code = ANY ($2::text[])
    )
  ORDER BY
    COALESCE(mi.parent_code::text, ''),
    COALESCE(mi.sort_order, 0),
    COALESCE(mi.label, mi.code)
`;

/**
 * GET /api/tenant/menus
 * Returns a flat, permission-filtered menu list for the current tenant.
 * Frontend nests by "parent_id" (string).
 */
router.get("/tenant/menus", async (req, res) => {
  try {
    const tenantId =
      req.session?.tenantId ??
      req.session?.tenant_id ??
      req.session?.user?.tenantId ??
      null;
    const userId = req.session?.userId ?? req.session?.user_id ?? null;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Permissions (mirrors your auth.js approach)
    const { rows: permRows } = await pool.query(
      `
      SELECT DISTINCT p.code
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_active = true
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.tenant_id = $1 AND ur.user_id = $2
      `,
      [tenantId, userId]
    );
    const permissions = permRows.map((r) => r.code);

    // Try parent_id version first, then fall back to parent_code on undefined_column (42703)
    try {
      const { rows } = await pool.query(QUERY_PARENT_ID, [tenantId, permissions]);
      return res.json({ items: rows });
    } catch (err1) {
      // undefined_column
      if (err1?.code === "42703") {
        req.log?.warn({ err: err1 }, "menus: parent_id not found, retrying with parent_code");
        const { rows } = await pool.query(QUERY_PARENT_CODE, [tenantId, permissions]);
        return res.json({ items: rows });
      }
      // Different error; rethrow to outer catch
      throw err1;
    }
  } catch (err) {
    req.log?.error({ err }, "GET /api/tenant/menus failed");
    return res.status(500).json({ error: "Failed to load menus" });
  }
});

export default router;
