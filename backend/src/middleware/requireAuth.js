// src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  const PUBLIC = new Set([
    "/", "/api/health",
    "/api/auth/login",
    "/api/auth/password/forgot",
    "/api/auth/password/reset",
    "/api/csrf/token", "/api/bootstrap"
  ]);
  if (PUBLIC.has(req.path) || req.path.startsWith("/api/csrf")) return next();

  const s = req.session || {};
  const userId   = s.userId   ?? s.user_id   ?? s.user?.id       ?? null;
  const tenantId = s.tenantId ?? s.tenant_id ?? s.user?.tenantId ?? null;
  if (!userId || !tenantId) return res.status(401).json({ message: "Unauthorized" });

  s.userId = s.user_id = userId;
  s.tenantId = s.tenant_id = tenantId;
  req.user = { id: userId, tenantId };
  next();
}
