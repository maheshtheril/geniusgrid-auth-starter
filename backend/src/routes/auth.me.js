import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * GET /api/auth/me[?probe=1]
 * Returns current user profile, roles, permissions, and menus for tenant.
 * PROBE mode returns step-by-step diagnostics to identify RLS/schema issues.
 */
router.get("/me", requireAuth, async (req, res) => {
  const user_id =
    req.session?.user_id ?? req.session?.userId ?? req.session?.user?.id;
  const tenant_id =
    req.session?.tenant_id ?? req.session?.tenantId ?? req.session?.user?.tenantId;

  if (!user_id || !tenant_id) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const sql = `
    WITH me AS (
      SELECT u.id AS user_id, u.email, COALESCE(u.name,'') AS name, u.is_active, u.tenant_id
      FROM public.res_users u
      WHERE u.id = $1 AND u.tenant_id = $2
    ),
    role_list AS (
      SELECT r.id, r.code, r.name
      FROM me
      JOIN public.user_roles ur ON ur.tenant_id = me.tenant_id AND ur.user_id = me.user_id
      JOIN public.roles r       ON r.id = ur.role_id AND r.tenant_id = me.tenant_id
    ),
    perm_list AS (
      SELECT DISTINCT p.code, p.name, p.description
      FROM me
      JOIN public.user_roles ur       ON ur.tenant_id = me.tenant_id AND ur.user_id = me.user_id
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p       ON p.id = rp.permission_id
    ),
    menu_base AS (
      SELECT mi.*
      FROM me
      JOIN public.menu_items mi
        ON mi.tenant_id = me.tenant_id
      LEFT JOIN public.tenant_modules tm
        ON tm.tenant_id = me.tenant_id
       AND tm.module_code = mi.module_code
       AND tm.status = 'installed'
      WHERE mi.is_active = true
        AND (mi.module_code IS NULL OR tm.module_code IS NOT NULL)
    ),
    allowed_menus AS (
      SELECT DISTINCT mb.*
      FROM menu_base mb
      LEFT JOIN perm_list pl ON pl.code = mb.permission_code
      WHERE mb.permission_code IS NULL
         OR mb.permission_code = ''
         OR pl.code IS NOT NULL
    )
    SELECT
      (SELECT row_to_json(me) FROM me) AS profile,
      COALESCE((SELECT json_agg(row_to_json(role_list)) FROM role_list), '[]'::json) AS roles,
      COALESCE((SELECT json_agg(row_to_json(perm_list)) FROM perm_list), '[]'::json) AS permissions,
      COALESCE(
        (SELECT json_agg(row_to_json(am))
           FROM allowed_menus am
          ORDER BY am.sort_order NULLS LAST, am.label),
        '[]'::json
      ) AS menus;
  `;

  let client;
  try {
    client = await pool.connect();
    // Set tenant scope on THIS connection so RLS passes
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenant_id]);

    // Optional probe mode to surface exact failing piece
    if (req.query.probe === "1") {
      const steps = [];
      const guc = await client.query(`SELECT current_setting('app.tenant_id', true) AS tenant`);
      steps.push({ step: "guc", tenant: guc.rows[0]?.tenant || null });

      const meVis = await client.query(
        `SELECT 1 FROM public.res_users WHERE id=$1 AND tenant_id=$2 LIMIT 1`,
        [user_id, tenant_id]
      );
      steps.push({ step: "res_users_visible", count: meVis.rowCount });

      const urVis = await client.query(
        `SELECT 1 FROM public.user_roles WHERE tenant_id=$1 AND user_id=$2 LIMIT 1`,
        [tenant_id, user_id]
      );
      steps.push({ step: "user_roles_visible", count: urVis.rowCount });

      const miCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM public.menu_items WHERE tenant_id=$1`,
        [tenant_id]
      );
      steps.push({ step: "menu_items_count", count: miCount.rows[0]?.c ?? null });

      const tmCount = await client.query(
        `SELECT COUNT(*)::int AS c FROM public.tenant_modules WHERE tenant_id=$1 AND status='installed'`,
        [tenant_id]
      );
      steps.push({ step: "tenant_modules_installed", count: tmCount.rows[0]?.c ?? null });

      // Try the full query to report exact error if it fails
      try {
        await client.query(sql, [user_id, tenant_id]);
        steps.push({ step: "full_query", ok: true });
        return res.json({ ok: true, steps });
      } catch (err) {
        return res.status(500).json({
          ok: false,
          steps,
          code: err.code || null,
          message: err.message,
          detail: err.detail || null,
          where: err.where || null,
        });
      }
    }

    // Normal /me response
    const { rows } = await client.query(sql, [user_id, tenant_id]);
    if (!rows?.length || !rows[0]?.profile) {
      return res.status(401).json({ error: "User not found in tenant" });
    }
    const { profile, roles, permissions, menus } = rows[0];
    return res.json({ profile, roles, permissions, menus });
  } catch (err) {
    console.error("[/api/auth/me] error:", { code: err.code, message: err.message });
    return res.status(500).json({ error: "Internal error" });
  } finally {
    if (client) client.release();
  }
});

export default router;
