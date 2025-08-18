// src/routes/tenantMenus.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ------------- small helpers ------------- */
async function tableExists(name) {
  const { rows } = await pool.query(
    `select exists (
       select 1 from information_schema.tables
       where table_schema='public' and table_name=$1
     ) as ok`,
    [name]
  );
  return rows[0]?.ok === true;
}
async function columnExists(tbl, col) {
  const { rows } = await pool.query(
    `select exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name=$1 and column_name=$2
     ) as ok`,
    [tbl, col]
  );
  return rows[0]?.ok === true;
}

/**
 * GET /api/tenant/menus
 * Returns flat list: { items: [{id,name,path,icon,parent_id,sort_order}, ...] }
 * - Sources from public.menu_templates (your schema)
 * - Optionally joins public.tenant_menus (if present)
 * - Optionally filters by permission_code (if permission tables exist)
 */
router.get("/tenant/menus", async (req, res) => {
  const tenantId =
    req.session?.tenantId ??
    req.session?.tenant_id ??
    req.session?.user?.tenantId ??
    null;
  const userId = req.session?.userId ?? req.session?.user_id ?? null;

  if (!tenantId || !userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // What’s available?
    const [
      hasTenantMenus,
      tmHasIsActive,
      mtHasPermission,
      hasUserRoles,
      hasRoles,
      hasRolePerms,
      hasPerms,
    ] = await Promise.all([
      tableExists("tenant_menus"),
      columnExists("tenant_menus", "is_active"),
      columnExists("menu_templates", "permission_code"),
      tableExists("user_roles"),
      tableExists("roles"),
      tableExists("role_permissions"),
      tableExists("permissions"),
    ]);

    // Permissions (best-effort)
    let permissions = [];
    const canFilterPerms = mtHasPermission && hasUserRoles && hasRoles && hasRolePerms && hasPerms;
    if (canFilterPerms) {
      const { rows } = await pool.query(
        `
        SELECT DISTINCT p.code
        FROM public.user_roles ur
        JOIN public.roles r            ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_active = true
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p       ON p.id = rp.permission_id
        WHERE ur.tenant_id = $1 AND ur.user_id = $2
        `,
        [tenantId, userId]
      );
      permissions = rows.map(r => r.code);
    }

    // Build dynamic SQL over menu_templates
    const selects = [
      "mt.id::text                 AS id",
      "COALESCE(mt.label, mt.code) AS name",
      "mt.path                     AS path",
      "mt.icon                     AS icon",
      "mt.parent_id::text          AS parent_id",
      "mt.sort_order               AS sort_order",
    ];
    const joins = [];
    const where = [];
    const params = [tenantId];

    // Restrict by tenant_menus mapping if it exists
    if (hasTenantMenus) {
      const activeClause = tmHasIsActive ? "AND tm.is_active = TRUE" : "";
      joins.push(`
        JOIN public.tenant_menus tm
          ON tm.menu_id = mt.id
         AND tm.tenant_id = $1
         ${activeClause}
      `);
    } else {
      // No mapping table → still scope by tenant via your app.tenant_id GUC or allow all templates
      // Nothing to join/filter here, menu_templates is global catalog.
    }

    // Permission filter (if we can compute user permissions)
    if (canFilterPerms) {
      params.push(permissions);
      where.push(`
        (mt.permission_code IS NULL
          OR mt.permission_code = ''
          OR mt.permission_code = ANY($2::text[]))
      `);
    }

    const sql = `
      SELECT ${selects.join(", ")}
      FROM public.menu_templates mt
      ${joins.join("\n")}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        COALESCE(mt.parent_id::text, ''),
        COALESCE(mt.sort_order, 0),
        COALESCE(mt.label, mt.code)
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ items: rows });
  } catch (err) {
    req.log?.error({ err }, "GET /api/tenant/menus failed");
    return res.status(500).json({ error: "Failed to load menus" });
  }
});

export default router;
