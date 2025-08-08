import { pool } from '../db/index.js';
import { sha256 } from '../services/crypto.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.gg_session;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  const { rows } = await pool.query(
    `SELECT user_id, tenant_id FROM user_sessions WHERE session_token_hash=$1 AND expires_at>now()`,
    [sha256(token)]
  );
  if (!rows.length) return res.status(401).json({ message: 'Unauthorized' });
  req.user = { id: rows[0].user_id, tenantId: rows[0].tenant_id };
  next();
}
