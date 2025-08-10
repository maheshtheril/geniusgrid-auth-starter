import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * GET /api/auth/me
 * Returns current user profile, roles, permissions, and menus for tenant
 * Schema aligned with:
 * - roles / user_roles / role_permissions / permissions
 * - tenant_modules + modules
 * - menu_items (tenant-scoped), gated by installed modules + permission_code
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    // Support both shapes (your login now sets both)
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
      -- Menus from menu_items, only for installed modules (or global menus with module_code IS NULL)
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

    const { rows } = await pool.query(sql, [user_id, tenant_id]);

    if (!rows?.length || !rows[0]?.profile) {
      return res.status(401).json({ error: "User not found in tenant" });
    }

    const { profile, roles, permissions, menus } = rows[0];
    return res.json({ profile, roles, permissions, menus });
  } catch (err) {
    console.error("[/api/auth/me] error:", err?.stack || err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// DEV ONLY: set IDs into the session (no auth)
router.post("/dev/set-session", (req, res) => {
  const { userId, tenantId } = req.body || {};
  if (!userId || !tenantId) return res.status(400).json({ message: "userId and tenantId required" });

  // no regenerate: keep current sid
  req.session.userId = userId;
  req.session.user_id = userId;
  req.session.tenantId = tenantId;
  req.session.tenant_id = tenantId;
  req.session.user = { id: userId, tenantId };

  req.session.save((err) => {
    if (err) return res.status(500).json({ message: "Session save error" });
    return res.json({ ok: true, session: { userId, tenantId } });
  });
});

// DEV ONLY: show current session payload (no auth)
router.get("/dev/show-session", (req, res) => {
  res.json({
    sid: req.sessionID || null,
    session: req.session || null,
  });
});


export default router;
