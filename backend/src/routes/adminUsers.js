import express from "express";
import { pool } from "../db/pool.js";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { logApi } from "../utils/logApi.js";

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

router.use(requireAuth, limiter);

// Helpers
async function setTenantScope(client, tenantId) {
  await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
}

function sanitizeUser(u) {
  return {
    id: u.id, email: u.email, name: u.name, phone: u.phone,
    is_active: u.is_active, email_verified: u.email_verified,
    company_id: u.company_id, last_login_at: u.last_login_at,
    created_at: u.created_at, updated_at: u.updated_at
  };
}

/**
 * GET /api/admin/users?search=&limit=20&offset=0&active=true
 * Needs: user_manage
 */
router.get("/users", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const { search = "", limit = 20, offset = 0, active } = req.query;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const filters = [];
    const params = [tenantId];
    let p = 2;

    if (search) {
      filters.push(`(lower(u.email) LIKE $${p} OR lower(u.name) LIKE $${p})`);
      params.push(`%${String(search).toLowerCase()}%`);
      p++;
    }
    if (active === "true") { filters.push(`u.is_active = true`); }
    if (active === "false") { filters.push(`u.is_active = false`); }

    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const q = `
      SELECT u.*
      FROM public.res_users u
      WHERE u.tenant_id = $1
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `;
    params.push(Number(limit), Number(offset));

    const { rows } = await client.query(q, params);
    const { rows: [{ count }] } = await client.query(
      `SELECT count(*)::int AS count
         FROM public.res_users u
        WHERE u.tenant_id = $1 ${where ? "AND " + where.slice(4) : ""}`,
      params.slice(0, params.length - 2) // same filters, no limit/offset
    );

    await client.query("COMMIT");
    res.json({ items: rows.map(sanitizeUser), count });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("list users error:", e);
    res.status(500).json({ message: "Failed to list users" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/users
 * Body: { email, name, phone?, companyId?, tempPassword? }
 * Needs: user_manage
 * - Creates user (password hashed by your DB trigger if present).
 * - Optionally seeds default company mapping.
 */
router.post("/users", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const { email, name, phone = null, companyId = null, tempPassword = null } = req.body || {};

  if (!email || !name) return res.status(400).json({ message: "email and name required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    // Create user
    const { rows: created } = await client.query(
      `INSERT INTO public.res_users
         (tenant_id, company_id, email, password, name, phone, is_active, email_verified)
       VALUES ($1, $2, $3, COALESCE($4,'Temp-1234'), $5, $6, true, false)
       RETURNING *`,
      [tenantId, companyId, email, tempPassword, name, phone]
    );
    const user = created[0];

    // Optional: map user to a company (if provided and not already)
    if (companyId) {
      await client.query(
        `INSERT INTO public.res_user_companies (tenant_id, user_id, company_id, is_default)
         VALUES ($1,$2,$3,true)
         ON CONFLICT DO NOTHING`,
        [tenantId, user.id, companyId]
      );
    }

    await logApi(client, {
      tenantId, userId: req.session.user.id, method: "POST", path: "/api/admin/users",
      statusCode: 201, reqBody: { email: "***" }, resBody: { id: user.id },
      ip: req.ip, userAgent: req.headers["user-agent"]
    });

    await client.query("COMMIT");
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (e) {
    await client.query("ROLLBACK");
    if (String(e.message || "").includes("duplicate")) {
      return res.status(409).json({ message: "Email already exists for this tenant" });
    }
    console.error("create user error:", e);
    res.status(500).json({ message: "Failed to create user" });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/admin/users/:id
 * Body: { name?, phone?, is_active?, companyId? }
 * Needs: user_manage
 */
router.patch("/users/:id", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const { id } = req.params;
  const { name, phone, is_active, companyId } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const fields = [];
    const params = [];
    let p = 1;

    if (name !== undefined) { fields.push(`name = $${p++}`); params.push(name); }
    if (phone !== undefined) { fields.push(`phone = $${p++}`); params.push(phone); }
    if (is_active !== undefined) { fields.push(`is_active = $${p++}`); params.push(!!is_active); }
    if (!fields.length && companyId === undefined) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "No changes" });
    }

    let updatedUser;
    if (fields.length) {
      const { rows } = await client.query(
        `UPDATE public.res_users
            SET ${fields.join(", ")}, updated_at = now()
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
      // fetch for response if only company mapping changes
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

    if (companyId !== undefined) {
      // set (or switch) default company mapping
      await client.query(
        `UPDATE public.res_user_companies SET is_default = false
          WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, id]
      );
      await client.query(
        `INSERT INTO public.res_user_companies (tenant_id, user_id, company_id, is_default)
         VALUES ($1,$2,$3,true)
         ON CONFLICT (id) DO NOTHING`,
        [tenantId, id, companyId]
      );
      await client.query(
        `UPDATE public.res_users SET company_id = $3, updated_at = now()
          WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId, companyId]
      );
    }

    await logApi(client, {
      tenantId, userId: req.session.user.id, method: "PATCH", path: `/api/admin/users/${id}`,
      statusCode: 200, reqBody: null, resBody: { ok: true },
      ip: req.ip, userAgent: req.headers["user-agent"]
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

/**
 * POST /api/admin/users/:id/roles
 * Body: { roleCodes: string[] }  // e.g. ["tenant_admin","user_manager"]
 * Needs: role_manage
 * - Replaces the user’s role set atomically.
 */
router.post("/users/:id/roles", requirePermission("role_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const { id } = req.params;
  const { roleCodes } = req.body || {};
  if (!Array.isArray(roleCodes)) return res.status(400).json({ message: "roleCodes array required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    // Resolve role ids for this tenant
    const { rows: roles } = await client.query(
      `SELECT id, code FROM public.roles WHERE tenant_id = $1 AND code = ANY($2::text[]) AND is_active = true`,
      [tenantId, roleCodes]
    );
    const foundCodes = new Set(roles.map(r => r.code));
    const missing = roleCodes.filter(c => !foundCodes.has(c));
    if (missing.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Unknown roles: ${missing.join(", ")}` });
    }

    // Ensure user exists & is in this tenant
    const { rows: users } = await client.query(
      `SELECT id FROM public.res_users WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!users[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    // Replace role set atomically
    await client.query(`DELETE FROM public.user_roles WHERE tenant_id = $1 AND user_id = $2`, [tenantId, id]);
    for (const r of roles) {
      await client.query(
        `INSERT INTO public.user_roles (tenant_id, user_id, role_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [tenantId, id, r.id]
      );
    }

    await logApi(client, {
      tenantId, userId: req.session.user.id, method: "POST", path: `/api/admin/users/${id}/roles`,
      statusCode: 200, reqBody: { roleCodes }, resBody: { ok: true },
      ip: req.ip, userAgent: req.headers["user-agent"]
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

/**
 * DELETE /api/admin/users/:id
 * Needs: user_manage
 * Soft-deactivate (keeps history & FKs safe).
 */
router.delete("/users/:id", requirePermission("user_manage"), async (req, res) => {
  const { tenantId } = req.session.user;
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenantScope(client, tenantId);

    const { rowCount } = await client.query(
      `UPDATE public.res_users SET is_active = false, updated_at = now()
        WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await logApi(client, {
      tenantId, userId: req.session.user.id, method: "DELETE", path: `/api/admin/users/${id}`,
      statusCode: 200, reqBody: null, resBody: { ok: true },
      ip: req.ip, userAgent: req.headers["user-agent"]
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
