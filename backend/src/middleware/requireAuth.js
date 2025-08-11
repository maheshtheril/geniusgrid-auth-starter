// src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  const s = req.session || {};

  // read BOTH shapes
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

  // helpful trace
  console.log("AUTH CHECK", {
    sid: req.sessionID,
    hasSession: !!req.session,
    userId, tenantId,
    keys: Object.keys(s || {})
  });

  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // normalize BOTH ways so downstream routes can read either
  s.userId = userId;
  s.user_id = userId;
  s.tenantId = tenantId;
  s.tenant_id = tenantId;
  s.user = { ...(s.user || {}), id: userId, tenantId };

  return next();
}
