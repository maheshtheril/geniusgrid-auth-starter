import { pool } from '../db/index.js';
import { sha256 } from '../services/crypto.js';

// src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  const userId =
    req.session?.userId ??
    req.session?.user?.id ??
    null;

  const tenantId =
    req.session?.tenantId ??
    req.session?.user?.tenantId ??
    null;
console.log("AUTH CHECK", {
  userId: req.session?.userId,
  tenantId: req.session?.tenantId,
  raw: req.session
});
  if (!userId || !tenantId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // normalize for downstream routes
  req.session.userId = userId;
  req.session.tenantId = tenantId;
  next();
}



