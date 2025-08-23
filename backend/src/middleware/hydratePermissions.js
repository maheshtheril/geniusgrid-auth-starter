// backend/src/middleware/hydratePermissions.js
import { pool } from "../db/pool.js";

export async function hydratePermissions(req, res, next) {
  try {
    const u = req.session?.user;
    if (!u) return next();

    // (Re)load only if missing; or force reload with a flag you set after changes
    if (!Array.isArray(u.permissions) || !u.permissions.length || u._permsStale) {
      const { rows } = await pool.query(
        `SELECT DISTINCT p.code
           FROM public.user_roles ur
           JOIN public.role_permissions rp ON rp.role_id = ur.role_id
           JOIN public.permissions p      ON p.id = rp.permission_id
          WHERE ur.tenant_id = $1 AND ur.user_id = $2`,
        [u.tenantId, u.id]
      );
      req.session.user.permissions = rows.map(r => r.code);
      // Also cache role codes if you want to use super-role bypass
      const roleRows = await pool.query(
        `SELECT r.code
           FROM public.user_roles ur
           JOIN public.roles r ON r.id = ur.role_id
          WHERE ur.tenant_id = $1 AND ur.user_id = $2`,
        [u.tenantId, u.id]
      );
      req.session.user.roleCodes = roleRows.rows.map(r => r.code);
      req.session.user._permsStale = false;
    }
    next();
  } catch (e) {
    console.error("hydratePermissions error:", e);
    next(); // don’t break requests; requirePermission will still guard
  }
}
