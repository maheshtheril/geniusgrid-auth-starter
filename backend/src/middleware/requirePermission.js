// src/middleware/requirePermission.js
export function requirePermission(code) {
  return (req, res, next) => {
    const perms = req.session?.user?.permissions || [];
    if (!perms.includes(code)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
