// src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  const s = req.session || {};

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
    // Helpful diagnostics in logs
    console.log("AUTH CHECK FAIL", {
      hasCookie: Boolean(req.headers.cookie),
      cookieSample: (req.headers.cookie || '').slice(0, 80),
      sessionID: req.sessionID,
      sessionKeys: Object.keys(s || {}),
      userId: s.userId, user_id: s.user_id, user: s.user,
      tenantId: s.tenantId, tenant_id: s.tenant_id,
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Normalize so downstream code can rely on both shapes
  s.userId = userId;
  s.user_id = userId;
  s.tenantId = tenantId;
  s.tenant_id = tenantId;

  // Also handy
  req.user = { id: userId, tenantId };

  next();
}
