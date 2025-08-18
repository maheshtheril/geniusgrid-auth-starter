// src/routes/tenantMenus.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

async function tableExists(name) {
  const { rows } = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1
     ) AS ok`, [name]
  );
  return rows[0]?.ok === true;
}
async function columnExists(tbl, col) {
  const { rows } = await pool.query(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2
     ) AS ok`, [tbl, col]
  );
  return rows[0]?.ok === true;
}

router.get("/tenant/menus", async (req, res) => {
  const tenantId = req.session?.tenantId ?? req.session?.tenant_id ?? req.session?.user?.tenantId ?? null;
  const userId   = req.session?.userId   ?? req.session?.user_id   ?? null;
  if (!tenantId || !userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const [
      hasTenantMenus,
      tmHasIsActive,
      mtHasPermission,
      hasUserRoles, hasRoles, hasRolePerms, hasPerms,
    ] = await Promise.all([
      tableExists("tenant_menus"),
      columnExists("tenant_menus", "is_active"),
      columnExists("menu_templates", "permission_code"),
      tableExists("user_roles"),
      tableExists("roles"),
      tableExists("role_permissions"),
      tableExists("permissions"),
    ]);

    // permission codes (best-effort)
    let permissions = [];
    const canFilterPerms = mtHasPermission && hasUserRoles && hasRoles && hasRolePerms && hasPerms;
    if (canFilterPerms) {
      const { rows } = await pool.query(
        `
        SELECT DISTINCT p.code
        FROM public.user_roles ur
        JOIN public.roles r             ON r.id = ur.role_id
                                       AND r.tenant_id = $1
                                       AND r.is_active = TRUE
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p       ON p.id = rp.permission_id
        WHERE ur.tenant_id = $1 AND ur.user_id = $2
        `,
        [tenantId, userId]
      );
      permissions = rows.map(r => r.code);
    }

    if (!hasTenantMenus) {
      // No tenant mapping: allow all templates (permission-filtered if available), then add ancestors.
      const permClause = canFilterPerms
        ? `WHERE (mt.permission_code IS NULL OR mt.permission_code = '' OR mt.permission_code = ANY($1::text[]))`
        : ``;
      const params = canFilterPerms ? [permissions] : [];
      const sql = `
        WITH RECURSIVE picked AS (
          SELECT mt.id, mt.label, mt.code, mt.path, mt.icon, mt.parent_id, mt.sort_order
          FROM public.menu_templates mt
          ${permClause}
          UNION ALL
          SELECT p.id, p.label, p.code, p.path, p.icon, p.parent_id, p.sort_order
          FROM public.menu_templates p
          JOIN picked c ON c.parent_id = p.id
        )
        SELECT DISTINCT
          picked.id::text                               AS id,
          COALESCE(picked.label, picked.code)           AS name,
          picked.path                                   AS path,
          picked.icon                                   AS icon,
          picked.parent_id::text                        AS parent_id,
          picked.sort_order                             AS sort_order
        FROM picked
        ORDER BY
          COALESCE(picked.parent_id::text, ''),
          COALESCE(picked.sort_order, 0),
          COALESCE(picked.label, picked.code)
      `;
      const { rows } = await pool.query(sql, params);
      return res.json({ items: rows });
    }

    // With tenant_menus: seed with allowed items (permission-filtered) + explicitly mapped top-level containers
    const params = [tenantId];
    const isActiveClause = tmHasIsActive ? "AND tm.is_active = TRUE" : "";
    const permClauseAllowed = canFilterPerms
      ? `AND (mt.permission_code IS NULL OR mt.permission_code = '' OR mt.permission_code = ANY($${params.push(permissions)}::text[]))`
      : "";

    const sql = `
      WITH
      base_allowed AS (
        SELECT mt.id, mt.label, mt.code, mt.path, mt.icon, mt.parent_id, mt.sort_order
        FROM public.menu_templates mt
        JOIN public.tenant_menus tm ON tm.menu_id = mt.id AND tm.tenant_id = $1 ${isActiveClause}
        WHERE 1=1
        ${permClauseAllowed}
      ),
      base_containers AS (
        -- mapped top-level parents (ensure CRM/Admin appear even if children filtered)
        SELECT mt.id, mt.label, mt.code, mt.path, mt.icon, mt.parent_id, mt.sort_order
        FROM public.menu_templates mt
        JOIN public.tenant_menus tm ON tm.menu_id = mt.id AND tm.tenant_id = $1 ${isActiveClause}
        WHERE mt.parent_id IS NULL
      ),
      seeds AS (
        SELECT * FROM base_allowed
        UNION
        SELECT * FROM base_containers
      ),
      picked AS (
        SELECT * FROM seeds
        UNION ALL
        SELECT p.*
        FROM public.menu_templates p
        JOIN picked c ON c.parent_id = p.id
      )
      SELECT DISTINCT
        picked.id::text                             AS id,
        COALESCE(picked.label, picked.code)         AS name,
        picked.path                                 AS path,
        picked.icon                                 AS icon,
        picked.parent_id::text                      AS parent_id,
        picked.sort_order                           AS sort_order
      FROM picked
      ORDER BY
        COALESCE(picked.parent_id::text, ''),
        COALESCE(picked.sort_order, 0),
        COALESCE(picked.label, picked.code)
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ items: rows });
  } catch (err) {
    req.log?.error({ err }, "GET /api/tenant/menus failed");
    return res.status(500).json({ error: "Failed to load menus" });
  }
});

export default router;
