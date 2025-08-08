import express from 'express';
import argon2 from 'argon2';
import { pool } from '../db/index.js';
import { randomToken, sha256 } from '../services/crypto.js';
import { sendVerificationEmail } from '../services/mailer.js';

const router = express.Router();

const argonOpts = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 1 << 16, // 64MB
  parallelism: 1,
};

router.post('/signup', async (req, res) => {
  const {
    fullName,
    email,
    password,
    companyName,
    subdomain,
    planCode = 'starter',
    acceptTerms,
    idempotencyKey,
  } = req.body || {};

  if (!fullName || !email || !password || !companyName || !subdomain || !acceptTerms) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (idempotencyKey) {
      const { rows: exist } = await client.query(
        `SELECT 1 FROM idempotency_keys WHERE endpoint=$1 AND idemp_key=$2 AND status='stored' FOR UPDATE`,
        ['/api/public/signup', idempotencyKey]
      );
      if (exist.length) {
        await client.query('COMMIT');
        return res.status(409).json({ message: 'Duplicate signup attempt' });
      }
      await client.query(
        `INSERT INTO idempotency_keys(tenant_id, endpoint, idemp_key, request_hash, status)
         VALUES (NULL,$1,$2,$3,'stored')`,
        ['/api/public/signup', idempotencyKey, sha256(JSON.stringify({ fullName, email, companyName, subdomain, planCode }))]
      );
    }

    const { rows: tRows } = await client.query(
      `INSERT INTO tenants(code, name, plan_code)
       VALUES ($1,$2,$3) RETURNING id`,
      [subdomain.toLowerCase(), companyName, planCode]
    );
    const tenantId = tRows[0].id;

    const { rows: cRows } = await client.query(
      `INSERT INTO res_company(tenant_id, name, code, country, timezone, functional_currency)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [tenantId, companyName, subdomain.toUpperCase(), 'India', 'Asia/Kolkata', 'INR']
    );
    const companyId = cRows[0].id;

    const passwordHash = await argon2.hash(password, argonOpts);
    const { rows: uRows } = await client.query(
      `INSERT INTO res_users(tenant_id, company_id, email, password, name, is_active, email_verified)
       VALUES ($1,$2,$3,$4,$5,true,false) RETURNING id,email`,
      [tenantId, companyId, email.toLowerCase(), passwordHash, fullName]
    );
    const userId = uRows[0].id;

    const roles = [
      { code: 'owner', name: 'Owner' },
      { code: 'admin', name: 'Admin' },
      { code: 'member', name: 'Member' },
    ];
    const roleIds = {};
    for (const r of roles) {
      const { rows } = await client.query(
        `INSERT INTO roles(tenant_id, code, name, is_system, is_active)
         VALUES ($1,$2,$3,false,true) RETURNING id`,
        [tenantId, r.code, r.name]
      );
      roleIds[r.code] = rows[0].id;
    }
    await client.query(`INSERT INTO user_roles(tenant_id, user_id, role_id) VALUES ($1,$2,$3)`, [tenantId, userId, roleIds.owner]);
    await client.query(`INSERT INTO res_user_companies(tenant_id, user_id, company_id, is_default) VALUES ($1,$2,$3,true)`, [tenantId, userId, companyId]);

    const raw = randomToken(32);
    const tokHash = sha256(raw);
    const expires = new Date(Date.now() + 24*60*60*1000);
    await client.query(
      `INSERT INTO auth_tokens(tenant_id, user_id, kind, token_hash, expires_at)
       VALUES ($1,$2,'verify_email',$3,$4)`,
      [tenantId, userId, tokHash, expires]
    );

    await client.query('COMMIT');

    const baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
    const verifyUrl = `${baseUrl}/verify-email?token=${raw}&email=${encodeURIComponent(email.toLowerCase())}`;
    await sendVerificationEmail({ to: email, verifyUrl });

    return res.status(201).json({ message: 'Signup successful. Check your email to verify.', tenantId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Signup error', err);
    const msg = err?.message?.includes('uq_tenants_code') ? 'Tenant subdomain already in use'
              : err?.message?.includes('uq_res_users_tenant_email') ? 'Email already in use for this tenant'
              : 'Signup failed';
    return res.status(400).json({ message: msg });
  } finally {
    client.release();
  }
});

router.get('/verify-email', async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) return res.status(400).json({ message: 'Missing token/email' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: uRows } = await client.query(
      `SELECT id, tenant_id FROM res_users WHERE email=$1 LIMIT 1`,
      [String(email).toLowerCase()]
    );
    if (!uRows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid link' });
    }
    const userId = uRows[0].id;
    const tenantId = uRows[0].tenant_id;

    const tHash = sha256(String(token));
    const { rows: tok } = await client.query(
      `SELECT id FROM auth_tokens
       WHERE user_id=$1 AND kind='verify_email' AND token_hash=$2 AND used_at IS NULL AND expires_at>now()
       LIMIT 1`,
      [userId, tHash]
    );
    if (!tok.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    await client.query(`UPDATE res_users SET email_verified=true WHERE id=$1`, [userId]);
    await client.query(`UPDATE auth_tokens SET used_at=now() WHERE id=$1`, [tok[0].id]);

    await client.query('COMMIT');

    const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
    const redirectTo = `${appUrl}/login?verified=1&tenantCode=${encodeURIComponent(tenantId)}`;
    res.redirect(302, redirectTo);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('verify-email error', e);
    res.status(500).json({ message: 'Verification failed' });
  } finally {
    client.release();
  }
});

export default router;
