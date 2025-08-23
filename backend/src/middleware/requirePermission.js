// backend/src/middleware/requirePermission.js
export function requirePermission(code) {
  return (req, res, next) => {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ message: "Unauthorized" });

    const perms = new Set(u.permissions || []);
    const roles = new Set(u.roleCodes || u.roles || []); // support either field

    if (perms.has(code) || roles.has("tenant_admin")) return next();

    // Helpful error to see on Network tab
    return res.status(403).json({
      message: "Forbidden",
      need: code,
      havePermissions: [...perms],
      haveRoles: [...roles],
      tenant: u.tenantId,
      user: u.email || u.id,
    });
  };
}
