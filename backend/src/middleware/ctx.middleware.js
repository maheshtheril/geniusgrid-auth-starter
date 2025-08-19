// src/middleware/ctx.middleware.js
export function attachCtx(req, _res, next) {
  const s = req.session || {};
  req.ctx = {
    tenantId: s.tenant_id ?? s.tenantId ?? null,
    userId:   s.user_id   ?? s.userId   ?? null,
    companyId: s.company_id ?? null,
    roles: Array.isArray(s.roles) ? s.roles : [],
  };
  next();
}
    