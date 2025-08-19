// api/middleware/tenant.js
// Reads tenant & user from your session/cookie/header and sets Postgres GUCs.
// Many of your views / helpers depend on app.tenant_id & app.user_id GUCs.
export async function attachTenantGUC(req, res, next) {
  // Adapt these lines to your auth:
  const tenantId = req.headers["x-tenant-id"] || req.session?.tenant_id;
  const userId   = req.headers["x-user-id"]   || req.session?.user_id;

  if (!tenantId) return res.status(400).json({ message: "Missing tenant" });
  req.ctx = { tenantId, userId: userId || null };
  next();
}
