import { pool } from '../db/index.js';
import { sha256 } from '../services/crypto.js';

export function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}


