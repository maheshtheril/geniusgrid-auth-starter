// src/middleware/requireAuth.js

/**
 * requireAuth
 * - Reads session IDs from all supported shapes (camelCase, snake_case, nested)
 * - Normalizes them back onto the session for downstream code
 * - Optional bypass via env (BYPASS_AUTH=1) for local/testing
 * - Optional debug logs via env (DEBUG_AUTH=1)
 */

export function requireAuth(req, res, next) {
  const s = req.session || {};

  // Toggleable bypass for local/testing
  if (process.env.BYPASS_AUTH === "1") {
    if (process.env.DEBUG_AUTH === "1") {
      console.log("AUTH BYPASS ENABLED — allowing request without session");
    }
    // Provide a minimal req.user for downstream convenience
    req.user = req.user || { id: s.userId || s.user_id || "dev-user", tenantId: s.tenantId || s.tenant_id || "dev-tenant" };
    return next();
  }

  // Read from ALL possible places (camelCase, snake_case, nested)
  const userId =
    s.userId ??
    s.user_id ??
    s.user?.id ??
    null;

  const tenantId =
    s.tenantId ??
    s.tenant_id ??
    s.user?.tenantId ??
    null;

  if (!userId || !tenantId) {
    if (process.env.DEBUG_AUTH === "1") {
      console.log("AUTH CHECK FAIL", {
        hasCookie: Boolean(req.headers.cookie),
        cookieSample: (req.headers.cookie || "").slice(0, 160),
        sessionID: req.sessionID,
        sessionKeys: Object.keys(s || {}),
        userId: s.userId, user_id: s.user_id, user: s.user,
        tenantId: s.tenantId, tenant_id: s.tenant_id,
      });
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Normalize so downstream code can rely on both shapes
  s.userId = userId;
  s.user_id = userId;
  s.tenantId = tenantId;
  s.tenant_id = tenantId;

  // Also handy for controllers
  req.user = { id: userId, tenantId };

  return next();
}
