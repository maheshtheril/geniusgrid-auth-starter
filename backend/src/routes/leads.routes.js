// src/routes/leads.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ---------- helpers ---------- */
function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    null
  );
}
function getCompanyId(req) {
  return (
    req.session?.companyId ||
    req.session?.company_id ||
    req.headers["x-company-id"] ||
    req.query.company_id ||
    null
  );
}
async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists on this PG connection (important for any RLS using current_setting)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* ---------- public probe (optional; server also exposes /api/leads/ping) ---------- */
router.get("/ping", (_req, res) => res.status(200).json({ ok: true }));

/* ---------- GET /api/leads?page&pageSize&q&status&stage&owner_id ---------- */
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req); // optional but used by your UI/DB
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? req.query.size, 10) || 25));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  const stage = (req.query.stage || "").trim();
  const owner_id = (req.query.owner_id || "").trim();

  // WHERE builder
  const params = [tenantId];
  let where = `WHERE tenant_id = $1`;
  let idx = params.length;

  if (companyId) {
    params.push(companyId); idx++;
    where += ` AND company_id::text = $${idx}`;
  }
  if (q) {
    params.push(`%${q}%`); idx++;
    where += ` AND (name ILIKE $${idx} OR company ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`;
  }
  if (status) {
    params.push(status); idx++;
    where += ` AND status = $${idx}`;
  }
  if (stage) {
    params.push(stage); idx++;
    where += ` AND stage = $${idx}`;
  }
  if (owner_id) {
    params.push(owner_id); idx++;
    where += ` AND owner_id::text = $${idx}`;
  }

  const offset = (page - 1) * size;

  // NOTE: alias fields to match your column keys (company_name, owner_name, created_at)
  const listSQL = `
    SELECT
      id,
      tenant_id,
      company_id,
      owner_id,
      name,
      company        AS company_name,
      email,
      phone,
      status,
      stage,
      owner          AS owner_name,
      score,
      priority,
      created_at,
      updated_at,
      ai_summary,
      ai_next,
      ai_score,
      ai_next_action
    FROM public.leads
    ${where}
    ORDER BY updated_at DESC
    LIMIT ${size} OFFSET ${offset};
  `;
  const countSQL = `SELECT COUNT(*)::int AS total FROM public.leads ${where};`;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId); // ensure any RLS sees the tenant

    const [list, count] = await Promise.all([
      client.query(listSQL, params),
      client.query(countSQL, params),
    ]);

    const items = (list.rows || []).map((r) => ({
      ...r,
      // normalize json
      ai_next: Array.isArray(r.ai_next)
        ? r.ai_next
        : typeof r.ai_next === "string" && r.ai_next.startsWith("[")
          ? JSON.parse(r.ai_next)
          : r.ai_next || [],
    }));

    res.json({ items, total: count.rows?.[0]?.total ?? 0, page, size });
  } catch (err) {
    console.error("GET /api/leads error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  } finally {
    client.release();
  }
});

/* ---------- GET /api/leads/pipelines  -> array of strings (UI expects .map on it) ---------- */
router.get("/pipelines", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const params = [tenantId];
  let where = `WHERE tenant_id = $1 AND stage IS NOT NULL AND stage <> ''`;
  let idx = params.length;

  if (companyId) {
    params.push(companyId); idx++;
    where += ` AND company_id::text = $${idx}`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT stage FROM public.leads ${where} ORDER BY stage ASC`,
      params
    );
    const stages = rows.map(r => r.stage);
    // return a plain array so your UI's stages.map(...) works
    res.json(stages.length ? stages : ["new", "qualified", "proposal", "won", "lost"]);
  } catch (err) {
    console.error("GET /leads/pipelines error:", err);
    // fall back to a sensible default list
    res.json(["new", "qualified", "proposal", "won", "lost"]);
  }
});

/* ---------- PATCH /api/leads/:id  { status?, stage?, owner_id? ... } ---------- */
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  const patch = req.body || {};
  const fields = [];
  const vals = [];
  let idx = 1;

  // allow updating a few safe fields from your UI
  for (const [key, col] of Object.entries({
    status: "status",
    stage: "stage",
    owner_id: "owner_id",
    priority: "priority",
    score: "score",
    ai_summary: "ai_summary",
    ai_next: "ai_next",
  })) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${++idx}`);
      vals.push(col === "ai_next" && Array.isArray(patch[key]) ? JSON.stringify(patch[key]) : patch[key]);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: "No updatable fields" });

  const whereVals = [id, tenantId];
  let whereSQL = `WHERE id = $1 AND tenant_id = $2`;
  if (companyId) {
    whereVals.push(companyId);
    whereSQL += ` AND company_id::text = $${whereVals.length}`;
  }

  const sql = `
    UPDATE public.leads
       SET ${fields.join(", ")}, updated_at = NOW()
     ${whereSQL}
     RETURNING id, status, stage, owner_id, priority, score, ai_summary, ai_next, updated_at;
  `;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const r = await client.query(sql, [...vals, ...whereVals]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next) ? row.ai_next : JSON.parse(row.ai_next || "[]");
    res.json(row);
  } catch (err) {
    console.error("PATCH /leads/:id error:", err);
    res.status(500).json({ error: "Failed to update lead" });
  } finally {
    client.release();
  }
});

export default router;
