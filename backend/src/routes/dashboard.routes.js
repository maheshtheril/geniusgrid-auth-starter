// src/routes/dashboard.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/* ---------- helpers ---------- */

function getTenantId(req) {
  // support both shapes in case middleware sets req.session.user
  return req.session?.tenantId || req.session?.user?.tenantId || null;
}
function getUserId(req) {
  return req.session?.userId || req.session?.user?.id || null;
}

async function setTenant(client, tenantId) {
  if (!tenantId) return;
  // local GUC for this txn/connection
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
}

function normalizeDateISO(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function defaultRangeIfMissing(from, to) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29); // last 30 days inclusive
  return {
    from: normalizeDateISO(from) || start.toISOString().slice(0, 10),
    to: normalizeDateISO(to) || today.toISOString().slice(0, 10),
  };
}

/* ---------- auth gate for all routes below ---------- */
router.use(requireAuth);

/**
 * GET /api/me
 * Returns the current user (scoped by tenant via RLS).
 */
router.get("/me", async (req, res) => {
  const userId = getUserId(req);
  const tenantId = getTenantId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenant(client, tenantId);

    const { rows } = await client.query(
      `SELECT id, email, name, is_active
         FROM public.res_users
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );

    await client.query("COMMIT");
    if (!rows.length) return res.status(404).json({ message: "User not found" });
    return res.json(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("GET /api/me error:", e);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/dashboard/sales-daily?from=YYYY-MM-DD&to=YYYY-MM-DD&companyId=<uuid?>
 * Returns daily series: orders_count, orders_amount, invoices_amount, cash_collected
 */
router.get("/dashboard/sales-daily", async (req, res) => {
  const tenantId = getTenantId(req);
  const { companyId } = req.query;
  const { from, to } = defaultRangeIfMissing(req.query.from, req.query.to);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenant(client, tenantId);

    const q = `
      SELECT day, orders_count, orders_amount, invoices_amount, cash_collected
      FROM public.prj_sales_daily
      WHERE tenant_id = current_setting('app.tenant_id')::uuid
        AND day BETWEEN $1 AND $2
        AND ($3::uuid IS NULL OR company_id = $3::uuid)
      ORDER BY day
    `;
    const { rows } = await client.query(q, [from, to, companyId || null]);

    await client.query("COMMIT");
    res.json(rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("GET /dashboard/sales-daily error:", e);
    res.status(500).json({ message: "Failed to load sales series" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/dashboard/usage-daily?from=&to=&metric=active_users
 * Returns daily values for a given metric key
 */
router.get("/dashboard/usage-daily", async (req, res) => {
  const tenantId = getTenantId(req);
  const { metric } = req.query;
  if (!metric) return res.status(400).json({ message: "metric is required" });

  const { from, to } = defaultRangeIfMissing(req.query.from, req.query.to);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenant(client, tenantId);

    const q = `
      SELECT day, value
      FROM public.usage_daily
      WHERE tenant_id = current_setting('app.tenant_id')::uuid
        AND metric = $3
        AND day BETWEEN $1 AND $2
      ORDER BY day
    `;
    const { rows } = await client.query(q, [from, to, metric]);

    await client.query("COMMIT");
    res.json(rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("GET /dashboard/usage-daily error:", e);
    res.status(500).json({ message: "Failed to load usage series" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/dashboard/health?from=&to=
 * Returns per-day auth failures and 5xx counts
 */
router.get("/dashboard/health", async (req, res) => {
  const tenantId = getTenantId(req);
  const { from, to } = defaultRangeIfMissing(req.query.from, req.query.to);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenant(client, tenantId);

    const q = `
      SELECT date_trunc('day', created_at)::date AS day,
             count(*) FILTER (WHERE status_code BETWEEN 500 AND 599) AS errors_5xx,
             count(*) FILTER (WHERE status_code IN (401,403))      AS auth_failures
      FROM public.api_request_logs
      WHERE tenant_id = current_setting('app.tenant_id')::uuid
        AND created_at::date BETWEEN $1 AND $2
      GROUP BY 1
      ORDER BY 1
    `;
    const { rows } = await client.query(q, [from, to]);

    await client.query("COMMIT");
    res.json(rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("GET /dashboard/health error:", e);
    res.status(500).json({ message: "Failed to load health series" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/modules/installed
 * Returns installed modules with labels/icons (for dynamic menus)
 */
router.get("/modules/installed", async (req, res) => {
  const tenantId = getTenantId(req);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTenant(client, tenantId);

    const q = `
      SELECT tm.module_code, m.name, m.category, m.icon, tm.status, tm.installed_at
      FROM public.tenant_modules tm
      JOIN public.modules m ON m.code = tm.module_code
      WHERE tm.tenant_id = current_setting('app.tenant_id')::uuid
      ORDER BY m.sort_order, m.name
    `;
    const { rows } = await client.query(q);

    await client.query("COMMIT");
    res.json(rows);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("GET /modules/installed error:", e);
    res.status(500).json({ message: "Failed to load installed modules" });
  } finally {
    client.release();
  }
});

export default router;
