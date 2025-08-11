// src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  // accept both camelCase and snake_case
  const userId =
    req.session?.userId ??
    req.session?.user_id ??
    req.session?.user?.id ??
    null;

  const tenantId =
    req.session?.tenantId ??
    req.session?.tenant_id ??
    req.session?.user?.tenantId ??
    null;

  // helpful debug
  console.log("AUTH CHECK", {
    keys: Object.keys(req.session || {}),
    userId, tenantId,
    sid: req.sessionID
  });

  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // normalize for downstream: write both shapes
  req.session.userId = userId;
  req.session.user_id = userId;
  req.session.tenantId = tenantId;
  req.session.tenant_id = tenantId;

  // optionally persist immediately
  req.session.save(() => next());
}
