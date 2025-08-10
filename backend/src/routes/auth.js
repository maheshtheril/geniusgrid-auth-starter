// src/routes/auth.js
import express from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool.js";
import { logApi } from "../utils/logApi.js";
import { newRawToken } from "../utils/token.js";
import { sendPasswordReset } from "../utils/mailer.js";
import { requireAuth } from "../middleware/requireAuth.js";
import bcrypt from "bcryptjs"; // safe in Render

const router = express.Router();

/* =========================
   Rate limits
========================= */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const changeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/* =========================
   Helpers
========================= */
function validatePasswordPolicy(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  return null;
}

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
  const permissions = permRows.map((r) => r.code);

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

function getTenantId(req) {
  return req.session?.tenantId ?? req.session?.tenant_id ?? req.session?.user?.tenantId ?? null;
}
function getUserId(req) {
  return req.session?.userId ?? req.session?.user_id ?? req.session?.user?.id ?? null;
}
async function setTenant(client, tenantId) {
  // IMPORTANT: non-local so the setting persists on this connection
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* =========================
   Auth: Change password
========================= */
router.post("/password/change", requireAuth, changeLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const path = "/api/auth/password/change";

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword required" });
  }
  const policyErr = validatePasswordPolicy(newPassword);
  if (policyErr) return res.status(400).json({ message: policyErr });

  const userId = getUserId(req);
  const tenantId = getTenantId(req);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenant(client, tenantId);

    // Verify current password via crypt()
    const { rows: ok } = await client.query(
      `SELECT 1 FROM public.res_users WHERE id = $1 AND password = crypt($2, password) LIMIT 1`,
      [userId, currentPassword]
    );
    if (ok.length === 0) {
      await logApi(client, {
        tenantId,
        userId,
        method: "POST",
        path,
        statusCode: 400,
        reqBody: null,
        resBody: { message: "Bad current password" },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password (DB trigger hashes it) and reset counters
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

    // Rotate the session id (mitigate fixation)
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    // Re-seed normalized session (set both shapes)
    req.session.userId = userId;
    req.session.user_id = userId;
    req.session.tenantId = tenantId;
    req.session.tenant_id = tenantId;
    req.session.user = { id: userId, tenantId };

    await logApi(client, {
      tenantId,
      userId,
      method: "POST",
      path,
      statusCode: 200,
      reqBody: null,
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
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

/* =========================
   Auth: Login
========================= */
/**
 * POST /api/auth/login
 * Body: { tenantCode | tenant, email, password }
 */
router.post("/login", loginLimiter, async (req, res) => {
  const { email: rawEmail, password, tenantCode: rawTenantCode, tenant } = req.body || {};
  const email = (rawEmail || "").trim().toLowerCase();
  const tenantCode = ((rawTenantCode || tenant) || "").trim();
  if (!email || !password || !tenantCode) {
    return res.status(400).json({ message: "tenantCode, email, password are required" });
  }

  const client = await pool.connect();
  try {
    const t = await client.query(`SELECT id, is_active FROM public.tenants WHERE code=$1`, [tenantCode]);
    if (!t.rows.length) return res.status(400).json({ message: "Invalid tenant" });
    const tenantId = t.rows[0].id;
    if (t.rows[0].is_active === false) return res.status(403).json({ message: "Tenant inactive" });

    await setTenant(client, tenantId);

    const { rows } = await client.query(
      `SELECT id, email, is_active, failed_attempts, locked_until,
              (password = crypt($3, password)) AS ok
         FROM public.res_users
        WHERE tenant_id = $1 AND lower(email) = $2
        LIMIT 1`,
      [tenantId, email, password]
    );
    if (!rows.length) return res.status(401).json({ message: "Invalid credentials" });

    const user = rows[0];

    if (process.env.DISABLE_LOGIN_LOCK === "1") {
      if (user.failed_attempts > 0 || user.locked_until) {
        await client.query(
          `UPDATE public.res_users
             SET failed_attempts = 0, locked_until = NULL, updated_at = now()
           WHERE id = $1`,
          [user.id]
        );
        user.failed_attempts = 0;
        user.locked_until = null;
      }
    }

    if (!user.is_active) return res.status(403).json({ message: "User inactive" });
    if (process.env.DISABLE_LOGIN_LOCK !== "1") {
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(423).json({ message: "Account locked. Try again later." });
      }
    }

    if (!user.ok) {
      await client.query(
        `UPDATE public.res_users
           SET failed_attempts = failed_attempts + 1,
               locked_until = CASE
                 WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval
                 ELSE locked_until END,
               updated_at = now()
         WHERE id = $1`,
        [user.id, MAX_ATTEMPTS, String(LOCK_MINUTES)]
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await client.query(
      `UPDATE public.res_users
         SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
       WHERE id = $1`,
      [user.id]
    );

    // Regenerate then set both camelCase and snake_case keys
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: "Session error" });

      req.session.userId = user.id;
      req.session.user_id = user.id;
      req.session.tenantId = tenantId;
      req.session.tenant_id = tenantId;
      req.session.user = { id: user.id, tenantId };

      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save error" });
        return res.json({ ok: true });
      });
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    res.status(500).json({ message: "Login error" });
  } finally {
    client.release();
  }
});

/* =========================
   Auth: Me (contextful)
========================= */
/**
 * NOTE: You also have GET /api/me in dashboard routes (minimal user).
 * This one returns full context (permissions, modules, menus) under /api/auth/me.
 */

/* =========================
   Auth: Logout
========================= */
router.post("/logout", (req, res) => {
  try {
    req.session.destroy(() => {
      res.clearCookie("__erp_sid");
      res.json({ ok: true });
    });
  } catch {
    res.json({ ok: true });
  }
});

/* =========================
   Auth: Forgot / Reset
========================= */
router.post("/password/forgot", resetLimiter, async (req, res) => {
  const { tenantCode, email } = req.body || {};
  if (!tenantCode || !email) {
    return res.status(400).json({ message: "tenantCode and email required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: t } = await client.query(
      `SELECT id, code, is_active FROM public.tenants WHERE code = $1`,
      [tenantCode]
    );
    const tenant = t[0];
    const done = () => res.json({ ok: true }); // always 200 to avoid enumeration

    if (!tenant || tenant.is_active !== true) {
      await client.query("ROLLBACK");
      return done();
    }

    await setTenant(client, tenant.id);

    const { rows: u } = await client.query(
      `SELECT id, email, is_active
         FROM public.res_users
        WHERE tenant_id=$1 AND lower(email)=lower($2)
        LIMIT 1`,
      [tenant.id, email]
    );
    const user = u[0];
    if (!user || user.is_active !== true) {
      await client.query("ROLLBACK");
      return done();
    }

    const raw = newRawToken(32);
    await client.query(
      `INSERT INTO public.auth_tokens (tenant_id, user_id, kind, token_hash, expires_at)
       VALUES ($1,$2,'pwd_reset', crypt($3, gen_salt('bf', 12)), now() + interval '30 minutes')`,
      [tenant.id, user.id, raw]
    );

    const resetUrl = `${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}/reset-password?tenant=${encodeURIComponent(
      tenant.code
    )}&email=${encodeURIComponent(user.email)}&token=${raw}`;

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

router.post("/password/reset", resetLimiter, async (req, res) => {
  const { tenantCode, email, token, newPassword } = req.body || {};
  if (!tenantCode || !email || !token || !newPassword) {
    return res.status(400).json({ message: "tenantCode, email, token, newPassword required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password too short" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: t } = await client.query(
      `SELECT id, code, is_active FROM public.tenants WHERE code = $1`,
      [tenantCode]
    );
    const tenant = t[0];
    if (!tenant || tenant.is_active !== true) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid reset request" });
    }

    await setTenant(client, tenant.id);

    const { rows: u } = await client.query(
      `SELECT id FROM public.res_users WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1`,
      [tenant.id, email]
    );
    const user = u[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid reset request" });
    }

    // verify token hash and expiry
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
    if (!valid) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // set new password (DB trigger hashes it)
    await client.query(
      `UPDATE public.res_users SET password = $2, updated_at = now() WHERE id = $1`,
      [user.id, newPassword]
    );

    // burn token(s)
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

/* =========================
   DEV HELPERS (remove for production)
========================= */

// DEV ONLY: set IDs into the session (no auth)
router.post("/dev/set-session", (req, res) => {
  const { userId, tenantId } = req.body || {};
  if (!userId || !tenantId) return res.status(400).json({ message: "userId and tenantId required" });

  // no regenerate: keep current sid
  req.session.userId = userId;
  req.session.user_id = userId;
  req.session.tenantId = tenantId;
  req.session.tenant_id = tenantId;
  req.session.user = { id: userId, tenantId };

  req.session.save((err) => {
    if (err) return res.status(500).json({ message: "Session save error" });
    return res.json({ ok: true, session: { userId, tenantId } });
  });
});

// DEV ONLY: show current session payload (no auth)
router.get("/dev/show-session", (req, res) => {
  res.json({
    sid: req.sessionID || null,
    session: req.session || null,
  });
});

// DEV ONLY: ensure demo admin exists and seed session
router.post("/dev/seed-admin", async (req, res) => {
  const { tenantCode = "demo", email = "admin@demo.local", password = "admin" } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const t = await client.query(
      `SELECT id FROM public.tenants WHERE code=$1 LIMIT 1`,
      [tenantCode]
    );
    if (t.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Tenant '${tenantCode}' not found` });
    }
    const tenantId = t.rows[0].id;

    await setTenant(client, tenantId);

    // ensure unique expression index for upsert on (tenant_id, lower(email))
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_res_users_tenant_lower_email
      ON public.res_users (tenant_id, lower(email))
    `);

    // update-then-insert to be compatible without named constraint
    const u = await client.query(
      `
      WITH up AS (
        UPDATE public.res_users
           SET password = crypt($3, gen_salt('bf',12)),
               is_active = true,
               name = COALESCE(name, 'Administrator'),
               failed_attempts = 0,
               locked_until = NULL,
               updated_at = now()
         WHERE tenant_id = $1 AND lower(email) = lower($2)
         RETURNING id
      ), ins AS (
        INSERT INTO public.res_users (tenant_id, email, password, is_active, name, failed_attempts, locked_until, updated_at)
        SELECT $1, $2, crypt($3, gen_salt('bf',12)), true, 'Administrator', 0, NULL, now()
        WHERE NOT EXISTS (SELECT 1 FROM up)
        RETURNING id
      )
      SELECT id FROM up
      UNION ALL
      SELECT id FROM ins
      LIMIT 1
      `,
      [tenantId, email, password]
    );
    const userId = u.rows[0].id;

    await client.query("COMMIT");

    // seed session (both shapes)
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: "Session error" });
      req.session.userId = userId;
      req.session.user_id = userId;
      req.session.tenantId = tenantId;
      req.session.tenant_id = tenantId;
      req.session.user = { id: userId, tenantId };
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: "Session save error" });
        return res.json({ ok: true, tenantId, userId });
      });
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[dev/seed-admin]", e);
    return res.status(500).json({ message: "seed-admin failed" });
  } finally {
    client.release();
  }
});

export default router;
