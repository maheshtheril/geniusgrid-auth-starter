// src/routes/tenantMenus.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/** GET /api/tenant/menus -> { items: [{id,name,path,icon,parent_id,sort_order}, ...] } */
router.get("/tenant/menus", async (req, res) => {
  try {
    const tenantId =
      req.session?.tenantId ??
      req.session?.tenant_id ??
      req.session?.user?.tenantId ??
      null;
    if (!tenantId) return res.status(401).json({ error: "Not authenticated" });

    // permissions for this user
    const { rows: permRows } = await pool.query(
      `
      SELECT DISTINCT p.code
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_active = true
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.tenant_id = $1 AND ur.user_id = $2
      `,
      [tenantId, req.session.userId ?? req.session.user_id]
    );
    const permissions = permRows.map((r) => r.code);

    // NOTE: if your schema uses parent_code, replace mi.parent_id with mi.parent_code
    const { rows } = await pool.query(
      `
      SELECT
        mi.id::text                 AS id,
        COALESCE(mi.label, mi.code) AS name,
        mi.path                     AS path,
        mi.icon                     AS icon,
        mi.parent_id::text          AS parent_id,
        mi.sort_order               AS sort_order
      FROM public.menu_items mi
      LEFT JOIN public.tenant_modules tm
        ON tm.tenant_id = mi.tenant_id
       AND tm.module_code = mi.module_code
       AND tm.status = 'installed'
      WHERE mi.tenant_id = $1
        AND mi.is_active = true
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
      `,
      [tenantId, permissions]
    );

    res.json({ items: rows });
  } catch (err) {
    req.log?.error({ err }, "GET /api/tenant/menus failed");
    res.status(500).json({ error: "Failed to load menus" });
  }
});

export default router;
