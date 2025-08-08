import express from 'express';
import argon2 from 'argon2';
import { pool } from '../db/index.js';
import { randomToken, sha256 } from '../services/crypto.js';
import { issueCsrf } from '../middleware/requireCsrf.js';

const router = express.Router();
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);

router.get('/csrf', issueCsrf);

router.post('/login', async (req, res) => {
  const { email, password, tenantCode } = req.body || {};
  if (!email || !password || !tenantCode) return res.status(400).json({ message: 'Missing fields' });

  const { rows: tRows } = await pool.query(`SELECT id FROM tenants WHERE code=$1 AND is_active=true`, [tenantCode.toLowerCase()]);
  if (!tRows.length) return res.status(401).json({ message: 'Invalid tenant' });
  const tenantId = tRows[0].id;

  const { rows: uRows } = await pool.query(
    `SELECT id, password, email_verified, name, company_id
     FROM res_users
     WHERE tenant_id=$1 AND email=$2 AND is_active=true
     LIMIT 1`,
    [tenantId, email.toLowerCase()]
  );
  if (!uRows.length) return res.status(401).json({ message: 'Invalid credentials' });

  const u = uRows[0];
  const ok = await argon2.verify(u.password, password);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  if (!u.email_verified) return res.status(403).json({ message: 'Please verify your email first' });

  const raw = randomToken(48);
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO user_sessions(tenant_id, user_id, session_token_hash, ip, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, u.id, tokenHash, req.ip, req.get('user-agent') || null, expiresAt]
  );

  res.cookie('gg_session', raw, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000,
  });

  return res.json({ user: { id: u.id, name: u.name, email: email.toLowerCase(), tenantId, companyId: u.company_id } });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies?.gg_session;
  if (token) {
    await pool.query(`DELETE FROM user_sessions WHERE session_token_hash=$1`, [sha256(token)]);
    res.clearCookie('gg_session', { path: '/' });
  }
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.gg_session;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  const { rows } = await pool.query(
    `SELECT us.user_id, us.tenant_id, ru.name, ru.email, ru.company_id
     FROM user_sessions us
     JOIN res_users ru ON ru.id = us.user_id
     WHERE us.session_token_hash=$1 AND us.expires_at>now()
     LIMIT 1`,
    [sha256(token)]
  );
  if (!rows.length) return res.status(401).json({ message: 'Session expired' });
  const r = rows[0];
  res.json({ user: { id: r.user_id, name: r.name, email: r.email }, tenantId: r.tenant_id, companyId: r.company_id });
});

export default router;
