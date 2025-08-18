// src/routes/tenantMenus.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ---------- tiny helpers to probe your schema ---------- */
async function tableExists(table) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS ok`,
    [table]
  );
  return rows[0]?.ok === true;
}
async function columnExists(table, column) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2
     ) AS ok`,
    [table, column]
  );
  return rows[0]?.ok === true;
}

/* ---------- GET /api/tenant/menus ---------- */
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
    // 1) Figure out schema shape
    const [
      hasMenuItems,
      hasParentId,
      hasParentCode,
      hasPermissionCode,
      hasModuleCode,
      hasTenantModules,
    ] = await Promise.all([
      tableExists("menu_items"),
      columnExists("menu_items", "parent_id"),
      columnExists("menu_items", "parent_code"),
      columnExists("menu_items", "permission_code"),
      columnExists("menu_items", "module_code"),
      tableExists("tenant_modules"),
    ]);

    if (!hasMenuItems) {
      req.log?.error("menus: public.menu_items table missing");
      return res.status(500).json({ error: "menu_items table missing" });
    }

    const parentCol = hasParentId ? "parent_id" : hasParentCode ? "parent_code" : null;
    if (!parentCol) {
      req.log?.error("menus: neither parent_id nor parent_code found");
      return res.status(500).json({ error: "No parent column in menu_items" });
    }

    // 2) Load permission codes if permission tables exist; otherwise skip filtering
    let permissions = [];
    let canFilterPermissions = false;
    try {
      const [hasUserRoles, hasRoles, hasRolePerms, hasPerms] = await Promise.all([
        tableExists("user_roles"),
        tableExists("roles"),
        tableExists("role_permissions"),
        tableExists("permissions"),
      ]);
      canFilterPermissions = hasUserRoles && hasRoles && hasRolePerms && hasPerms;

      if (canFilterPermissions) {
        const { rows: permRows } = await pool.query(
          `
          SELECT DISTINCT p.code
          FROM public.user_roles ur
          JOIN public.roles r           ON r.id = ur.role_id
                                       AND r.tenant_id = $1
                                       AND r.is_active = true
          JOIN public.role_permissions rp ON rp.role_id = r.id
          JOIN public.permissions p       ON p.id = rp.permission_id
          WHERE ur.tenant_id = $1 AND ur.user_id = $2
          `,
          [tenantId, userId]
        );
        permissions = permRows.map((r) => r.code);
      }
    } catch (e) {
      // If permission tables are half-present, just skip filtering
      req.log?.warn({ err: e }, "menus: skipping permission filter due to schema");
      canFilterPermissions = false;
    }

    // 3) Build query dynamically based on available columns/tables
    const selects = [
      "mi.id::text AS id",
      "COALESCE(mi.label, mi.code) AS name",
      "mi.path AS path",
      "mi.icon AS icon",
      `mi.${parentCol}::text AS parent_id`,
      "mi.sort_order AS sort_order",
    ];

    const joins = [];
    const wheres = [
      "mi.tenant_id = $1",
      "mi.is_active = true",
    ];
    const orders = [
      `COALESCE(mi.${parentCol}::text, '')`,
      "COALESCE(mi.sort_order, 0)",
      "COALESCE(mi.label, mi.code)",
    ];

    // Join/filter by installed modules if both sides exist
    if (hasTenantModules && hasModuleCode) {
      // Check if tenant_modules has status column
      const tmHasStatus = await columnExists("tenant_modules", "status");
      joins.push(
        `LEFT JOIN public.tenant_modules tm
           ON tm.tenant_id = mi.tenant_id
          AND tm.module_code = mi.module_code
          ${tmHasStatus ? `AND tm.status = 'installed'` : ""}`
      );
      wheres.push(`(mi.module_code IS NULL OR tm.module_code IS NOT NULL)`);
    }

    // Permission filter if column exists and we loaded permissions
    let params = [tenantId];
    if (hasPermissionCode && canFilterPermissions) {
      wheres.push(
        `(mi.permission_code IS NULL
          OR mi.permission_code = ''
          OR mi.permission_code = ANY ($2::text[]))`
      );
      params.push(permissions);
    }

    const sql = `
      SELECT ${selects.join(", ")}
      FROM public.menu_items mi
      ${joins.join("\n")}
      WHERE ${wheres.join("\n  AND ")}
      ORDER BY ${orders.join(", ")}
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ items: rows });
  } catch (err) {
    // Return a concise error to the client, log details server-side
    req.log?.error({ err }, "GET /api/tenant/menus failed");
    return res.status(500).json({ error: "Failed to load menus" });
  }
});

export default router;
