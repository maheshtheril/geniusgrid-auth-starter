// backend/src/routes/users.routes.js
import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { logApi } from "../utils/logApi.js";

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
router.use(requireAuth, limiter);

/* ----------------------------- Helpers ----------------------------- */

async function setTenantScope(client, tenantId) {
  // Works with RLS policies referencing current_setting('app.tenant_id', true)
  await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
}

const SORTABLE = new Set(["created_at", "name", "email", "last_active"]);
function sortClause(by = "created_at", dir = "desc") {
  const col = SORTABLE.has(String(by)) ? String(by) : "created_at";
  const d = String(dir).toLowerCase() === "asc" ? "asc" : "desc";
  return { col, d };
}

function sanitizeUser(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    is_active: u.is_active,
    email_verified: u.email_verified,
    is_locked: u.is_locked ?? false,
    locked_until: u.locked_until ?? null,
    company_id: u.company_id,
    last_login_at: u.last_login_at ?? null,
    last_active: u.last_active ?? null,
    created_at: u.created_at,
    updated_at: u.updated_at,
    roles: u.roles || [],
    role_ids: u.role_ids || [],
    companies: u.companies || [],
    company_ids: u.company_ids || [],
  };
}

/* ===================================================================
 * GET /api/admin/users
 * Query:
 *   q, status(Active|Suspended|Invited), role_id, company_id,
 *   sort_by(created_at|name|email|last_active), sort_dir(asc|desc),
 *   page(1..), page_size(10/25/50)
 * Needs: user_manage
 * =================================================================== */
router.get("/users", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const {
    q = "",
    status = "",
    role_id = "",
    company_id = "",
    sort_by = "created_at",
    sort_dir = "desc",
    page = 1,
    page_size = 25,
  } = req.query;

  const { col, d } = sortClause(sort_by, sort_dir);
  const limit = Math.max(1, Math.min(200, Number(page_size)));
  const offset = Math.max(0, (Math.max(1, Number(page)) - 1) * limit);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    // Decide how to compute last_active (user_sessions vs connect-pg-simple session table)
    const { rows: [flags] } = await client.query(`
      SELECT
        (to_regclass('public.user_sessions') IS NOT NULL) AS has_user_sessions,
        (to_regclass('public.session')       IS NOT NULL) AS has_pg_session
    `);

    const lastActiveExpr = flags?.has_user_sessions
      ? `(SELECT max(s.created_at)
            FROM public.user_sessions s
           WHERE s.tenant_id = u.tenant_id AND s.user_id = u.id)`
      : (flags?.has_pg_session
          ? `(SELECT max(s.expire AT TIME ZONE 'UTC')
                FROM public.session s
               WHERE (s.sess->'user'->>'id')::uuid = u.id
                 AND COALESCE((s.sess->'user'->>'tenantId')::uuid, u.tenant_id) = u.tenant_id)`
          : `NULL::timestamptz`);

    // WHERE
    const params = [tenantId];
    let idx = 2;
    const where = [`u.tenant_id = $1`];

    if (q) {
      params.push(`%${String(q).toLowerCase()}%`);
      where.push(
        `(LOWER(u.name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR COALESCE(u.phone,'') LIKE $${idx})`
      );
      idx++;
    }
    if (role_id) {
      params.push(role_id);
      where.push(
        `EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.tenant_id=u.tenant_id AND ur.user_id=u.id AND ur.role_id=$${idx})`
      );
      idx++;
    }
    if (company_id) {
      params.push(company_id);
      where.push(
        `EXISTS (SELECT 1 FROM public.res_user_companies uc WHERE uc.tenant_id=u.tenant_id AND uc.user_id=u.id AND uc.company_id=$${idx})`
      );
      idx++;
    }
    if (status) {
      if (status === "Active")
        where.push(`u.is_active = true AND COALESCE(u.is_locked,false) = false`);
      else if (status === "Suspended")
        where.push(`COALESCE(u.is_locked,false) = true`);
      else if (status === "Invited")
        where.push(`u.email_verified = false`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Base CTE with last_active
    const base = `
      WITH base AS (
        SELECT u.*,
               ${lastActiveExpr} AS last_active
          FROM public.res_users u
          ${whereSql}
      )
    `;

    // List
    const listSql = `
      ${base}
      SELECT b.*,
             COALESCE((
               SELECT array_agg(r.name ORDER BY r.name)
                 FROM public.user_roles ur
                 JOIN public.roles r ON r.id = ur.role_id
                WHERE ur.tenant_id = b.tenant_id AND ur.user_id = b.id AND r.is_active
             ), '{}'::text[]) AS roles,
             COALESCE((
               SELECT array_agg(ur.role_id)
                 FROM public.user_roles ur
                WHERE ur.tenant_id = b.tenant_id AND ur.user_id = b.id
             ), '{}'::uuid[]) AS role_ids,
             COALESCE((
               SELECT array_agg(c.name ORDER BY c.name)
                 FROM public.res_user_companies uc
                 JOIN public.res_company c ON c.id = uc.company_id
                WHERE uc.tenant_id = b.tenant_id AND uc.user_id = b.id
             ), '{}'::text[]) AS companies,
             COALESCE((
               SELECT array_agg(uc.company_id)
                 FROM public.res_user_companies uc
                WHERE uc.tenant_id = b.tenant_id AND uc.user_id = b.id
             ), '{}'::uuid[]) AS company_ids
      FROM base b
      ORDER BY ${col} ${d}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const listParams = [...params, limit, offset];

    // Count
    const cntSql = `SELECT count(*)::int AS count FROM public.res_users u ${whereSql}`;
    const cntParams = [...params];

    const [list, cnt] = await Promise.all([
      client.query(listSql, listParams),
      client.query(cntSql, cntParams),
    ]);

    await client.query("COMMIT");
    res.json({
      items: list.rows.map(sanitizeUser),
      total: cnt.rows?.[0]?.count || 0,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("list users error:", e);
    res.status(500).json({ message: "Failed to list users" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * POST /api/admin/users
 * Body: { email, name, phone?, is_active?, is_locked?, role_ids?, company_ids?, default_company_id?, tempPassword? }
 * Needs: user_manage
 * =================================================================== */
router.post("/users", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const {
    email,
    name,
    phone = null,
    is_active = true,
    is_locked = false,
    role_ids = [],
    company_ids = [],
    default_company_id = null,
    tempPassword = null,
  } = req.body || {};

  if (!email || !name) {
    return res.status(400).json({ message: "email and name required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    // Create user
    const ins = await client.query(
      `INSERT INTO public.res_users
         (tenant_id, company_id, email, password, name, phone, is_active, is_locked, email_verified)
       VALUES ($1, $2, $3, COALESCE($4,'Temp-1234'), $5, $6, $7, $8, false)
       RETURNING *`,
      [
        tenantId,
        default_company_id,
        String(email).toLowerCase(),
        tempPassword,
        name,
        phone,
        !!is_active,
        !!is_locked,
      ]
    );
    const user = ins.rows[0];
    const userId = user.id;

    // Roles (tolerant upsert)
    if (Array.isArray(role_ids) && role_ids.length) {
      const values = role_ids.map((_, i) => `($1,$2,$${i + 3})`).join(",");
      await client.query(
        `INSERT INTO public.user_roles (tenant_id, user_id, role_id)
           VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [tenantId, userId, ...role_ids]
      );
    }

    // Companies (tolerant upsert)
    if (Array.isArray(company_ids) && company_ids.length) {
      const values = company_ids.map((_, i) => `($1,$2,$${i + 3},false)`).join(",");
      await client.query(
        `INSERT INTO public.res_user_companies (tenant_id, user_id, company_id, is_default)
           VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [tenantId, userId, ...company_ids]
      );
    }

    // Default company
    if (default_company_id) {
      await client.query(
        `UPDATE public.res_user_companies
            SET is_default = (company_id = $3)
          WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, userId, default_company_id]
      );
      await client.query(
        `UPDATE public.res_users
            SET company_id = $3, updated_at = now()
          WHERE id = $2 AND tenant_id = $1`,
        [tenantId, userId, default_company_id]
      );
    }

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "POST",
      path: "/api/admin/users",
      statusCode: 201,
      reqBody: { email: "***" },
      resBody: { id: userId },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (e) {
    await client.query("ROLLBACK");
    if (String(e.message || "").toLowerCase().includes("duplicate")) {
      return res
        .status(409)
        .json({ message: "Email already exists for this tenant" });
    }
    console.error("create user error:", e);
    res.status(500).json({ message: "Failed to create user" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * PATCH /api/admin/users/:id
 * Body: { name?, phone?, is_active?, is_locked?, role_ids?, company_ids?, default_company_id? }
 * Needs: user_manage
 * =================================================================== */
router.patch("/users/:id", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { id } = req.params;
  const {
    name,
    phone,
    is_active,
    is_locked,
    role_ids,
    company_ids,
    default_company_id,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const updates = [];
    const params = [];
    let p = 1;

    if (name !== undefined) { updates.push(`name = $${p++}`); params.push(name); }
    if (phone !== undefined) { updates.push(`phone = $${p++}`); params.push(phone); }
    if (is_active !== undefined) { updates.push(`is_active = $${p++}`); params.push(!!is_active); }
    if (is_locked !== undefined) { updates.push(`is_locked = $${p++}`); params.push(!!is_locked); }

    let updatedUser;
    if (updates.length) {
      const { rows } = await client.query(
        `UPDATE public.res_users
            SET ${updates.join(", ")}, updated_at = now()
          WHERE id = $${p} AND tenant_id = $${p + 1}
          RETURNING *`,
        [...params, id, tenantId]
      );
      updatedUser = rows[0];
      if (!updatedUser) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "User not found" });
      }
    } else {
      const { rows } = await client.query(
        `SELECT * FROM public.res_users WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
      updatedUser = rows[0];
      if (!updatedUser) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "User not found" });
      }
    }

    // Replace roles if provided
    if (Array.isArray(role_ids)) {
      await client.query(
        `DELETE FROM public.user_roles WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, id]
      );
      if (role_ids.length) {
        const values = role_ids.map((_, i) => `($1,$2,$${i + 3})`).join(",");
        await client.query(
          `INSERT INTO public.user_roles (tenant_id, user_id, role_id)
             VALUES ${values}
           ON CONFLICT DO NOTHING`,
          [tenantId, id, ...role_ids]
        );
      }
    }

    // Replace companies if provided
    if (Array.isArray(company_ids)) {
      await client.query(
        `DELETE FROM public.res_user_companies WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, id]
      );
      if (company_ids.length) {
        const values = company_ids.map((_, i) => `($1,$2,$${i + 3},false)`).join(",");
        await client.query(
          `INSERT INTO public.res_user_companies (tenant_id, user_id, company_id, is_default)
             VALUES ${values}
           ON CONFLICT DO NOTHING`,
          [tenantId, id, ...company_ids]
        );
      }
    }

    // Default company update if provided
    if (default_company_id !== undefined) {
      if (default_company_id) {
        await client.query(
          `UPDATE public.res_user_companies SET is_default = false WHERE tenant_id=$1 AND user_id=$2`,
          [tenantId, id]
        );
        await client.query(
          `UPDATE public.res_user_companies SET is_default = true  WHERE tenant_id=$1 AND user_id=$2 AND company_id=$3`,
          [tenantId, id, default_company_id]
        );
      }
      await client.query(
        `UPDATE public.res_users SET company_id = $3, updated_at = now()
          WHERE id = $2 AND tenant_id = $1`,
        [tenantId, id, default_company_id || null]
      );
    }

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "PATCH",
      path: `/api/admin/users/${id}`,
      statusCode: 200,
      reqBody: null,
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    res.json({ user: sanitizeUser(updatedUser) });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("update user error:", e);
    res.status(500).json({ message: "Failed to update user" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * POST /api/admin/users/:id/roles
 * Body: { roleCodes: string[] }  // replace role set
 * Needs: role_manage
 * =================================================================== */
router.post("/users/:id/roles", requirePermission("role_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { id } = req.params;
  const { roleCodes } = req.body || {};
  if (!Array.isArray(roleCodes)) return res.status(400).json({ message: "roleCodes array required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const { rows: roles } = await client.query(
      `SELECT id, code FROM public.roles
        WHERE tenant_id = $1 AND is_active = true AND code = ANY($2::text[])`,
      [tenantId, roleCodes]
    );
    const found = new Set(roles.map(r => r.code));
    const missing = roleCodes.filter(c => !found.has(c));
    if (missing.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Unknown roles: ${missing.join(", ")}` });
    }

    const { rowCount: exists } = await client.query(
      `SELECT 1 FROM public.res_users WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!exists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await client.query(`DELETE FROM public.user_roles WHERE tenant_id = $1 AND user_id = $2`, [tenantId, id]);
    for (const r of roles) {
      await client.query(
        `INSERT INTO public.user_roles (tenant_id, user_id, role_id)
         VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [tenantId, id, r.id]
      );
    }

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "POST",
      path: `/api/admin/users/${id}/roles`,
      statusCode: 200,
      reqBody: { roleCodes },
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("assign roles error:", e);
    res.status(500).json({ message: "Failed to assign roles" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * POST /api/admin/users/:id/companies
 * Body: { company_ids: uuid[], default_company_id?: uuid }
 * Needs: user_manage
 * =================================================================== */
router.post("/users/:id/companies", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { id } = req.params;
  const { company_ids = [], default_company_id = null } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    await client.query(
      `DELETE FROM public.res_user_companies WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, id]
    );

    if (Array.isArray(company_ids) && company_ids.length) {
      const values = company_ids.map((_, i) => `($1,$2,$${i + 3},false)`).join(",");
      await client.query(
        `INSERT INTO public.res_user_companies (tenant_id, user_id, company_id, is_default)
           VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [tenantId, id, ...company_ids]
      );
    }

    await client.query(
      `UPDATE public.res_users SET company_id = $3, updated_at = now()
        WHERE id = $2 AND tenant_id = $1`,
      [tenantId, id, default_company_id || null]
    );

    if (default_company_id) {
      await client.query(
        `UPDATE public.res_user_companies
            SET is_default = (company_id = $3)
          WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, id, default_company_id]
      );
    }

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "POST",
      path: `/api/admin/users/${id}/companies`,
      statusCode: 200,
      reqBody: { company_ids, default_company_id },
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("set companies error:", e);
    res.status(500).json({ message: "Failed to set companies" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * POST /api/admin/users/bulk
 * Body: { ids: uuid[], patch: { is_active?, is_locked? } }
 * Needs: user_manage
 * =================================================================== */
router.post("/users/bulk", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { ids = [], patch = {} } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ message: "ids required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const ops = [];
    const params = [];
    let p = 1;

    if (patch.is_active !== undefined) { ops.push(`is_active = $${p++}`); params.push(!!patch.is_active); }
    if (patch.is_locked !== undefined) { ops.push(`is_locked = $${p++}`); params.push(!!patch.is_locked); }

    if (!ops.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No patch fields" });
    }

    params.push(tenantId, ids);
    await client.query(
      `UPDATE public.res_users
          SET ${ops.join(", ")}, updated_at = now()
        WHERE tenant_id = $${p} AND id = ANY($${p + 1}::uuid[])`,
      params
    );

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "POST",
      path: `/api/admin/users/bulk`,
      statusCode: 200,
      reqBody: { n: ids.length },
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("bulk update users error:", e);
    res.status(500).json({ message: "Failed to bulk update" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * POST /api/admin/users/:id/invite
 * Creates auth_tokens row (purpose='invite', 7-day expiry)
 * Needs: user_manage
 * =================================================================== */
router.post("/users/:id/invite", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { id } = req.params;
  const token = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const { rowCount: exists } = await client.query(
      `SELECT 1 FROM public.res_users WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!exists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await client.query(
      `INSERT INTO public.auth_tokens (tenant_id, user_id, purpose, token, expires_at, used)
       VALUES ($1,$2,'invite',$3, now() + interval '7 days', false)`,
      [tenantId, id, token]
    );

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "POST",
      path: `/api/admin/users/${id}/invite`,
      statusCode: 200,
      reqBody: null,
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    // TODO: send email with invite link containing token
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("invite error:", e);
    res.status(500).json({ message: "Failed to create invite" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * POST /api/admin/users/:id/reset-password
 * Creates auth_tokens row (purpose='password_reset', 24h)
 * Needs: user_manage
 * =================================================================== */
router.post("/users/:id/reset-password", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { id } = req.params;
  const token = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const { rowCount: exists } = await client.query(
      `SELECT 1 FROM public.res_users WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!exists) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await client.query(
      `INSERT INTO public.auth_tokens (tenant_id, user_id, purpose, token, expires_at, used)
       VALUES ($1,$2,'password_reset',$3, now() + interval '1 day', false)`,
      [tenantId, id, token]
    );

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "POST",
      path: `/api/admin/users/${id}/reset-password`,
      statusCode: 200,
      reqBody: null,
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    // TODO: send email with reset link containing token
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("reset-password error:", e);
    res.status(500).json({ message: "Failed to create reset token" });
  } finally {
    client.release();
  }
});

/* ===================================================================
 * GET /api/admin/roles?onlyActive=1
 * Needs: user_manage
 * =================================================================== */
router.get("/roles", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const onlyActive = String(req.query.onlyActive || "0") === "1";

  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const rows = await client
      .query(
        `SELECT id, code, name
           FROM public.roles
          WHERE tenant_id = $1 ${onlyActive ? "AND is_active" : ""}
          ORDER BY name`,
        [tenantId]
      )
      .then((r) => r.rows);
    res.json(rows);
  } catch (e) {
    console.error("list roles error:", e);
    res.json([]);
  } finally {
    client.release();
  }
});

/* ===================================================================
 * GET /api/admin/companies?onlyActive=1
 * Needs: user_manage
 * =================================================================== */
router.get("/companies", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const onlyActive = String(req.query.onlyActive || "0") === "1";

  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const rows = await client
      .query(
        `SELECT id, name
           FROM public.res_company
          WHERE tenant_id = $1 ${onlyActive ? "AND is_active" : ""}
          ORDER BY name`,
        [tenantId]
      )
      .then((r) => r.rows);
    res.json(rows);
  } catch (e) {
    console.error("list companies error:", e);
    res.json([]);
  } finally {
    client.release();
  }
});

/* ===================================================================
 * GET /api/admin/users/:id/activity
 * Shows last 50 sessions/events
 * Needs: user_manage
 * =================================================================== */
router.get("/users/:id/activity", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);

    const { rows: [flags] } = await client.query(`
      SELECT
        (to_regclass('public.user_sessions') IS NOT NULL) AS has_user_sessions,
        (to_regclass('public.session')       IS NOT NULL) AS has_pg_session
    `);

    let rows = [];
    if (flags?.has_user_sessions) {
      const r = await client.query(
        `SELECT 'Login session' AS title, created_at AS ts
           FROM public.user_sessions
          WHERE tenant_id = $1 AND user_id = $2
          ORDER BY created_at DESC
          LIMIT 50`,
        [tenantId, id]
      );
      rows = r.rows;
    } else if (flags?.has_pg_session) {
      const r = await client.query(
        `SELECT 'Session' AS title, (expire AT TIME ZONE 'UTC') AS ts
           FROM public.session
          WHERE (sess->'user'->>'id')::uuid = $2
            AND COALESCE((sess->'user'->>'tenantId')::uuid, $1) = $1
          ORDER BY expire DESC
          LIMIT 50`,
        [tenantId, id]
      );
      rows = r.rows;
    }
    res.json(rows);
  } catch (e) {
    console.error("activity error:", e);
    res.json([]);
  } finally {
    client.release();
  }
});

/* ===================================================================
 * DELETE /api/admin/users/:id
 * Soft deactivate user
 * Needs: user_manage
 * =================================================================== */
router.delete("/users/:id", requirePermission("user_manage"), async (req, res) => {
  const { tenantId, id: actorId } = req.session.user;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const { rowCount } = await client.query(
      `UPDATE public.res_users
          SET is_active = false, updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await logApi(client, {
      tenantId,
      userId: actorId,
      method: "DELETE",
      path: `/api/admin/users/${id}`,
      statusCode: 200,
      reqBody: null,
      resBody: { ok: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("deactivate user error:", e);
    res.status(500).json({ message: "Failed to deactivate user" });
  } finally {
    client.release();
  }
});

export default router;
