// src/routes/dashboard.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";            // your pg Pool
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Helpers
async function setTenant(client, tenantId) {
  await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
}

function normalizeDateISO(v) {
  // accepts 'YYYY-MM-DD' or Date; returns 'YYYY-MM-DD'
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function defaultRangeIfMissing(from, to) {
  // default to last 30 days, inclusive
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - 29);
  return {
    from: normalizeDateISO(from) || start.toISOString().slice(0, 10),
    to: normalizeDateISO(to) || today.toISOString().slice(0, 10),
  };
}

// All routes require a logged-in session
router.use(requireAuth);

/**
 * GET /api/dashboard/sales-daily?from=YYYY-MM-DD&to=YYYY-MM-DD&companyId=<uuid?>
 * Returns daily series: orders_count, orders_amount, invoices_amount, cash_collected
 */
router.get("/dashboard/sales-daily", async (req, res) => {
  const { tenantId } = req.session.user;
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
    console.error("sales-daily error:", e);
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
  const { tenantId } = req.session.user;
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
    console.error("usage-daily error:", e);
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
  const { tenantId } = req.session.user;
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
    console.error("health error:", e);
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
  const { tenantId } = req.session.user;

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
    console.error("modules/installed error:", e);
    res.status(500).json({ message: "Failed to load installed modules" });
  } finally {
    client.release();
  }
});

export default router;
