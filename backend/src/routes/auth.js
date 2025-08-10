// src/routes/auth.js
import express from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool.js";
import { logApi } from "../utils/logApi.js"; // <-- we added earlier
import { newRawToken } from "../utils/token.js";
import { sendPasswordReset } from "../utils/mailer.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // limit each IP to 5 requests per windowMs
  standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
});
const MAX_ATTEMPTS = 5;   // lock after 5 bad attempts
const LOCK_MINUTES = 15;  // lock window

const changeLimiter = rateLimit({ windowMs: 15*60*1000, max: 20 });

function validatePasswordPolicy(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  // Optional: add stronger checks
  // if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use upper, lower, number.";
  return null;
}

router.post("/password/change", requireAuth, changeLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const path = "/api/auth/password/change";

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword required" });
  }

  const policyErr = validatePasswordPolicy(newPassword);
  if (policyErr) return res.status(400).json({ message: policyErr });

  const { id: userId, tenantId } = req.session.user;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);

    // Verify current password via crypt()
    const { rows: ok } = await client.query(
      `SELECT 1 FROM public.res_users WHERE id = $1 AND password = crypt($2, password) LIMIT 1`,
      [userId, currentPassword]
    );
    if (ok.length === 0) {
      await logApi(client, {
        tenantId, userId, method: "POST", path, statusCode: 400,
        reqBody: null, resBody: { message: "Bad current password" }, ip: req.ip, userAgent: req.headers["user-agent"]
      });
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password (your trigger/migration hashes it), reset counters
    await client.query(
      `UPDATE public.res_users
          SET password = $2,
              failed_attempts = 0,
              locked_until = NULL,
              updated_at = now()
        WHERE id = $1`,
      [userId, newPassword]
    );

    // Burn any outstanding password-reset tokens
    await client.query(
      `UPDATE public.auth_tokens
          SET used_at = now()
        WHERE user_id = $1 AND kind = 'pwd_reset' AND used_at IS NULL`,
      [userId]
    );

    // Optional: if you keep your own user_sessions table in use, you could invalidate others here.

    // Rotate the session id (mitigate fixation)
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => (err ? reject(err) : resolve()));
    });
    // Re-seed minimal session payload
    req.session.user = { ...req.session.user, id: userId, tenantId };

    await logApi(client, {
      tenantId, userId, method: "POST", path, statusCode: 200,
      reqBody: null, resBody: { ok: true }, ip: req.ip, userAgent: req.headers["user-agent"]
    });

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("change password error:", e);
    return res.status(500).json({ message: "Change password failed" });
  } finally {
    client.release();
  }
});
// Build user context: permissions, installed modules, menus
async function loadContext(client, tenantId, userId) {
  const permsQ = `
    SELECT DISTINCT p.code
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id AND r.tenant_id = $1 AND r.is_active = true
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.tenant_id = $1 AND ur.user_id = $2
  `;
  const { rows: permRows } = await client.query(permsQ, [tenantId, userId]);
  const permissions = permRows.map(r => r.code);

  const modsQ = `
    SELECT m.code, m.name, m.icon, m.category, m.description
    FROM public.tenant_modules tm
    JOIN public.modules m ON m.code = tm.module_code
    WHERE tm.tenant_id = $1 AND tm.status = 'installed'
    ORDER BY m.sort_order, m.name
  `;
  const { rows: modules } = await client.query(modsQ, [tenantId]);

  const menusQ = `
    SELECT mi.id, mi.code, mi.label, mi.path, mi.icon, mi.module_code, mi.permission_code, mi.sort_order
    FROM public.menu_items mi
    LEFT JOIN public.tenant_modules tm
      ON tm.tenant_id = mi.tenant_id AND tm.module_code = mi.module_code AND tm.status = 'installed'
    WHERE mi.tenant_id = $1
      AND mi.is_active = true
      AND (mi.module_code IS NULL OR tm.module_code IS NOT NULL)
      AND (
        mi.permission_code IS NULL
        OR mi.permission_code = ''
        OR mi.permission_code = ANY ($2::text[])
      )
    ORDER BY mi.sort_order, mi.label
  `;
  const { rows: menus } = await client.query(menusQ, [tenantId, permissions]);

  return { permissions, modules, menus };
}

/**
 * POST /api/auth/login
 * Body: { tenantCode: string, email: string, password: string }
 */
router.post("/login", loginLimiter, async (req, res) => {
  const { tenantCode, email, password } = req.body || {};
  if (!tenantCode || !email || !password) {
    return res.status(400).json({ message: "tenantCode, email, password are required" });
  }

  const client = await pool.connect();
  const path = "/api/auth/login";

  try {
    await client.query("BEGIN");

    // 1) Tenant
    const { rows: tRows } = await client.query(
      `SELECT id, code, is_active FROM public.tenants WHERE code = $1`,
      [tenantCode]
    );
    const tenant = tRows[0];

    if (!tenant || tenant.is_active !== true) {
      // AUDIT: invalid tenant
      await logApi(client, {
        tenantId: null, userId: null, method: "POST", path,
        statusCode: 401, ip: req.ip, userAgent: req.headers["user-agent"],
        reqBody: { tenantCode, email: "***" }, resBody: { message: "Invalid tenant" }
      });
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Set tenant for RLS
    await client.query(`SET LOCAL app.tenant_id = $1`, [tenant.id]);

    // 2) Lookup user (don’t check password yet)
    const { rows: uLookup } = await client.query(
      `SELECT id, tenant_id, email, name, is_active, last_login_at, failed_attempts, locked_until
         FROM public.res_users
        WHERE tenant_id = $1 AND lower(email) = lower($2)
        LIMIT 1`,
      [tenant.id, email]
    );
    const u0 = uLookup[0];

    const deny = async (status, msg) => {
      await logApi(client, {
        tenantId: tenant.id, userId: u0?.id || null, method: "POST", path,
        statusCode: status, ip: req.ip, userAgent: req.headers["user-agent"],
        reqBody: { email: "***" }, resBody: { message: msg }
      });
      await client.query("COMMIT"); // commit counters if we updated them
      return res.status(status).json({ message: "Invalid credentials" });
    };

    if (!u0 || u0.is_active !== true) {
      // Optional: dummy crypt for timing uniformity
      await client.query(`SELECT crypt($1, gen_salt('bf', 10))`, [password]);
      return await deny(401, "Invalid credentials");
    }

    // 3) Lockout window?
    if (u0.locked_until && new Date(u0.locked_until) > new Date()) {
      await logApi(client, {
        tenantId: tenant.id, userId: u0.id, method: "POST", path,
        statusCode: 423, ip: req.ip, userAgent: req.headers["user-agent"],
        reqBody: { email: "***" }, resBody: { message: "Account locked" }
      });
      await client.query("ROLLBACK");
      return res.status(423).json({ message: "Account temporarily locked. Try again later." });
    }

    // 4) Real password check
    const { rows: uRows } = await client.query(
      `SELECT id, tenant_id, company_id, email, name
         FROM public.res_users
        WHERE id = $1
          AND password = crypt($2, password)
          AND is_active = true
        LIMIT 1`,
      [u0.id, password]
    );
    const user = uRows[0];

    if (!user) {
      const willLock = (u0.failed_attempts + 1) >= MAX_ATTEMPTS;
      await client.query(
        `UPDATE public.res_users
            SET failed_attempts = failed_attempts + 1,
                locked_until = CASE WHEN $3 THEN now() + ($2 || ' minutes')::interval ELSE NULL END,
                updated_at = now()
          WHERE id = $1`,
        [u0.id, LOCK_MINUTES, willLock]
      );
      return await deny(401, willLock ? "Locked" : "Invalid credentials");
    }

    // 5) Success: reset attempts, set last_login_at
    await client.query(
      `UPDATE public.res_users
          SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
        WHERE id = $1`,
      [user.id]
    );

    // Load context
    const { permissions, modules, menus } = await loadContext(client, tenant.id, user.id);

    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: tenant.id,
      tenantCode: tenant.code,
      permissions
    };

    // AUDIT: success
    await logApi(client, {
      tenantId: tenant.id, userId: user.id, method: "POST", path,
      statusCode: 200, ip: req.ip, userAgent: req.headers["user-agent"],
      reqBody: null, resBody: { ok: true }
    });

    await client.query("COMMIT");
    return res.json({ user: req.session.user, modules, menus });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Login error:", err);
    // AUDIT: server error
    try {
      await pool.query(
        `INSERT INTO public.api_request_logs
           (tenant_id, user_id, method, path, status_code, request_body, response_body, ip, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [null, null, "POST", "/api/auth/login", 500, { email: "***" }, { message: "Login failed" }, req.ip, req.headers["user-agent"]]
      );
    } catch (_) {}
    return res.status(500).json({ message: "Login failed" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/auth/me
 * Returns current user + context
 */
router.get("/me", async (req, res) => {
  const sess = req.session?.user;
  if (!sess) return res.status(401).json({ message: "Unauthorized" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.tenant_id = $1`, [sess.tenantId]);

    const { permissions, modules, menus } = await loadContext(client, sess.tenantId, sess.id);
    req.session.user.permissions = permissions;

    await client.query("COMMIT");
    res.json({ user: { ...sess, permissions }, modules, menus });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Me error:", e);
    res.status(500).json({ message: "Failed to load session context" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post("/password/forgot", resetLimiter, async (req, res) => {
  const { tenantCode, email } = req.body || {};
  if (!tenantCode || !email) return res.status(400).json({ message: "tenantCode and email required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: t } = await client.query(
      `SELECT id, code, is_active FROM public.tenants WHERE code = $1`, [tenantCode]
    );
    const tenant = t[0];
    // Always return 200 to prevent user enumeration
    const done = () => res.json({ ok: true });

    if (!tenant || tenant.is_active !== true) { await client.query("ROLLBACK"); return done(); }

    await client.query(`SET LOCAL app.tenant_id = $1`, [tenant.id]);
    const { rows: u } = await client.query(
      `SELECT id, email, is_active FROM public.res_users
       WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1`,
      [tenant.id, email]
    );
    const user = u[0];
    if (!user || user.is_active !== true) { await client.query("ROLLBACK"); return done(); }

    // Create raw token and store only hash (bcrypt via pgcrypto)
    const raw = newRawToken(32);
    const { rows: ins } = await client.query(
      `INSERT INTO public.auth_tokens (tenant_id, user_id, kind, token_hash, expires_at)
       VALUES ($1,$2,'pwd_reset', crypt($3, gen_salt('bf', 12)), now() + interval '30 minutes')
       RETURNING id`,
      [tenant.id, user.id, raw]
    );

    // Build reset URL for your frontend (adjust domain)
    const resetUrl = `${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/reset-password?tenant=${encodeURIComponent(tenant.code)}&email=${encodeURIComponent(user.email)}&token=${raw}`;

    // Send email/SMS (stubbed)
    await sendPasswordReset({ to: user.email, tenantCode: tenant.code, resetUrl });

    await client.query("COMMIT");
    return done();
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("forgot error:", e);
    return res.json({ ok: true }); // still hide details
  } finally {
    client.release();
  }
});

/**
 * Body: { tenantCode, email, token, newPassword }
 */
router.post("/password/reset", resetLimiter, async (req, res) => {
  const { tenantCode, email, token, newPassword } = req.body || {};
  if (!tenantCode || !email || !token || !newPassword) {
    return res.status(400).json({ message: "tenantCode, email, token, newPassword required" });
  }
  if (newPassword.length < 8) return res.status(400).json({ message: "Password too short" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: t } = await client.query(
      `SELECT id, code, is_active FROM public.tenants WHERE code = $1`, [tenantCode]
    );
    const tenant = t[0];
    if (!tenant || tenant.is_active !== true) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Invalid reset request" }); }

    await client.query(`SET LOCAL app.tenant_id = $1`, [tenant.id]);

    // Find the user
    const { rows: u } = await client.query(
      `SELECT id FROM public.res_users WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1`,
      [tenant.id, email]
    );
    const user = u[0];
    if (!user) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Invalid reset request" }); }

    // Verify token (hash compare) and validity
    const { rows: tok } = await client.query(
      `SELECT id
         FROM public.auth_tokens
        WHERE user_id = $1
          AND kind = 'pwd_reset'
          AND used_at IS NULL
          AND expires_at > now()
          AND token_hash = crypt($2, token_hash)
        ORDER BY expires_at DESC
        LIMIT 1`,
      [user.id, token]
    );
    const valid = tok[0];
    if (!valid) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Invalid or expired token" }); }

    // Set new password (your trigger hashes it if you kept the hashing trigger)
    await client.query(
      `UPDATE public.res_users SET password = $2, updated_at = now() WHERE id = $1`,
      [user.id, newPassword]
    );

    // Burn the token + optionally burn siblings
    await client.query(`UPDATE public.auth_tokens SET used_at = now() WHERE id = $1`, [valid.id]);
    await client.query(
      `UPDATE public.auth_tokens
          SET used_at = now()
        WHERE user_id = $1 AND kind='pwd_reset' AND used_at IS NULL`,
      [user.id]
    );

    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("reset error:", e);
    return res.status(500).json({ message: "Reset failed" });
  } finally {
    client.release();
  }
});


export default router;
