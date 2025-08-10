import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * GET /api/auth/me
 * Returns current user profile, roles, permissions, and menus for tenant
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user_id = req.session?.user_id;
    const tenant_id = req.session?.tenant_id;

    if (!user_id || !tenant_id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const sql = `
      WITH me AS (
        SELECT u.id AS user_id, u.email, COALESCE(u.name,'') AS name, u.is_active, u.tenant_id
        FROM res_users u
        WHERE u.id = $1 AND u.tenant_id = $2
      ),
      role_list AS (
        SELECT r.id, r.code, r.name
        FROM me
        JOIN user_roles ur ON ur.tenant_id = me.tenant_id AND ur.user_id = me.user_id
        JOIN roles r       ON r.id = ur.role_id
      ),
      perm_list AS (
        SELECT DISTINCT p.code, p.name, p.description
        FROM me
        JOIN user_roles ur       ON ur.tenant_id = me.tenant_id AND ur.user_id = me.user_id
        JOIN role_permissions rp ON rp.tenant_id = me.tenant_id AND rp.role_id = ur.role_id
        JOIN permissions p       ON p.id = rp.permission_id
      ),
      menu_base AS (
        SELECT m.*
        FROM tenant_menus tm
        JOIN menu_templates m ON m.id = tm.menu_id
        JOIN me ON tm.tenant_id = me.tenant_id
        WHERE tm.is_enabled = true
      ),
      allowed_menus AS (
        SELECT DISTINCT mb.*
        FROM menu_base mb
        LEFT JOIN perm_list pl ON pl.code = mb.permission_code
        WHERE mb.permission_code IS NULL OR pl.code IS NOT NULL
      )
      SELECT
        (SELECT row_to_json(me) FROM me) AS profile,
        COALESCE((SELECT json_agg(row_to_json(role_list)) FROM role_list), '[]'::json) AS roles,
        COALESCE((SELECT json_agg(row_to_json(perm_list)) FROM perm_list), '[]'::json) AS permissions,
        COALESCE(
          (SELECT json_agg(row_to_json(am)) FROM allowed_menus am ORDER BY am.sort_order NULLS LAST, am.name),
          '[]'::json
        ) AS menus;
    `;

    const { rows } = await pool.query(sql, [user_id, tenant_id]);

    if (!rows?.length || !rows[0]?.profile) {
      return res.status(401).json({ error: "User not found in tenant" });
    }

    const { profile, roles, permissions, menus } = rows[0];
    res.json({ profile, roles, permissions, menus });

  } catch (err) {
    console.error("[/api/auth/me] error:", err?.stack || err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
