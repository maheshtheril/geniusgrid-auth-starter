// src/routes/leads.routes.js — FULL
// Express routes aligned to public.leads schema with RLS/tenant scoping
// Endpoints:
//   GET    /api/leads/ping
//   GET    /api/leads                (list with filters, paging)
//   GET    /api/leads/pipelines      (distinct stages as array)
//   GET    /api/leads/stages         (alias of pipelines)
//   GET    /api/leads/check-mobile   (?phone= or ?mobile=)
//   POST   /api/leads                (create)
//   PATCH  /api/leads/:id            (update selected fields)

import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ---------------- helpers ---------------- */
function getTenantId(req) {
  // Express lower-cases header names
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}
function getCompanyId(req) {
  return (
    req.session?.companyId ||
    req.session?.company_id ||
    req.get("x-company-id") ||
    req.query.company_id ||
    null
  );
}
async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists on this connection (critical for ensure_tenant_scope() + RLS)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* ---------------- probe ---------------- */
router.get("/ping", (_req, res) => res.json({ ok: true }));

/* ---------------- GET /api/leads ----------------
   Query: page, pageSize (or size), q, status, stage, owner_id
   Returns: { items, total, page, size }
-------------------------------------------------- */
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? req.query.size, 10) || 25));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  const stage = (req.query.stage || "").trim();
  const owner_id = (req.query.owner_id || "").trim();

  const params = [tenantId];
  let where = `WHERE tenant_id = $1`;
  let i = params.length;

  if (companyId) { params.push(companyId); where += ` AND company_id::text = $${++i}`; }
  if (q)         { params.push(`%${q}%`);  where += ` AND (name ILIKE $${++i} OR company ILIKE $${i} OR email ILIKE $${i} OR phone ILIKE $${i})`; }
  if (status)    { params.push(status);    where += ` AND status = $${++i}`; }
  if (stage)     { params.push(stage);     where += ` AND stage  = $${++i}`; }
  if (owner_id)  { params.push(owner_id);  where += ` AND owner_id::text = $${++i}`; }

  const offset = (page - 1) * size;

  // Alias to match typical UI columns
  const listSQL = `
    SELECT
      id,
      tenant_id,
      company_id,
      owner_id,
      name,
      company AS company_name,
      email,
      phone,
      source,
      status,
      stage,
      owner   AS owner_name,
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
    await setTenant(client, tenantId);

    const [list, count] = await Promise.all([
      client.query(listSQL, params),
      client.query(countSQL, params),
    ]);

    const items = (list.rows || []).map((r) => ({
      ...r,
      ai_next: Array.isArray(r.ai_next)
        ? r.ai_next
        : typeof r.ai_next === "string" && r.ai_next.startsWith("[")
          ? JSON.parse(r.ai_next)
          : r.ai_next || [],
    }));

    res.json({ items, total: count.rows?.[0]?.total ?? 0, page, size });
  } catch (err) {
    console.error("GET /leads error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  } finally {
    client.release();
  }
});

/* ---------------- Distinct stages helper ---------------- */
async function loadStageList(tenantId, companyId) {
  const params = [tenantId];
  let where = `WHERE tenant_id = $1 AND stage IS NOT NULL AND stage <> ''`;
  let j = params.length;

  if (companyId) { params.push(companyId); where += ` AND company_id::text = $${++j}`; }

  const { rows } = await pool.query(
    `SELECT DISTINCT stage FROM public.leads ${where} ORDER BY stage ASC`,
    params
  );
  const stages = rows.map((r) => r.stage).filter(Boolean);
  return stages.length ? stages : ["new", "qualified", "proposal", "won", "lost"];
}

router.get("/pipelines", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  try {
    const stages = await loadStageList(tenantId, getCompanyId(req));
    res.json(stages); // plain array
  } catch (err) {
    console.error("GET /leads/pipelines error:", err);
    res.json(["new", "qualified", "proposal", "won", "lost"]);
  }
});

router.get("/stages", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  try {
    const stages = await loadStageList(tenantId, getCompanyId(req));
    res.json(stages);
  } catch (err) {
    console.error("GET /leads/stages error:", err);
    res.json(["new", "qualified", "proposal", "won", "lost"]);
  }
});

/* ---------------- GET /api/leads/check-mobile ----------------
   Usage: /api/leads/check-mobile?phone=+91%209876543210
-------------------------------------------------------------- */
router.get("/check-mobile", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ exists: false, error: "No tenant" });

  const raw = String(req.query.phone ?? req.query.mobile ?? "").trim();
  if (!raw) return res.json({ exists: false, reason: "empty" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    // Normalize using DB function to match stored leads
    const normRes = await client.query("SELECT public.phone_to_norm($1) AS pn", [raw]);
    const pn = normRes.rows?.[0]?.pn || null;

    if (!pn) return res.json({ exists: false, reason: "invalid" });
    if (pn.length < 6) return res.json({ exists: false, reason: "too_short", phone_norm: pn });

    const { rows } = await client.query(
      `SELECT id, name FROM public.leads
       WHERE tenant_id = ensure_tenant_scope() AND phone_norm = $1
       LIMIT 1`,
      [pn]
    );

    return res.json({ exists: rows.length > 0, lead: rows[0] || null, phone_norm: pn });
  } catch (err) {
    console.error("GET /leads/check-mobile error:", err);
    return res.status(500).json({ exists: false, error: "server_error" });
  } finally {
    client.release();
  }
});

/* ---------------- POST /api/leads ----------------
   Body: { name*, phone, email, source, status, stage, followup_at(ISO), custom(json) }
   Uses tenant_id from session/header and optional company_id.
--------------------------------------------------- */
router.post("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);

  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  // Accept E.164-ish phone, DB will normalize via phone_to_norm()
  const phone = b.phone ? String(b.phone).trim() : null;
  const email = b.email ? String(b.email).trim() : null;
  const source = b.source ? String(b.source).trim() : null;
  const status = b.status ? String(b.status).trim() : "new";
  const stage  = b.stage  ? String(b.stage).trim()  : null;

  // Accept either ISO string or null
  const followup_at = b.followup_at ? new Date(b.followup_at) : null;

  // jsonb column
  const custom = (b.custom && typeof b.custom === "object") ? b.custom : {};

  const sql = `
    INSERT INTO public.leads
      (tenant_id, company_id, name, email, phone, source, status, stage, followup_at, custom)
    VALUES
      ($1,        $2,         $3,   $4,    $5,    $6,     $7,     $8,    $9,         $10)
    RETURNING id, tenant_id, company_id, name, email, phone, source, status, stage, followup_at, created_at;
  `;
  const params = [tenantId, companyId, name, email, phone, source, status, stage, followup_at, custom];

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const { rows } = await client.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /leads error:", err);

    // Common Postgres error codes
    if (err.code === "23514") {
      // CHECK constraint (e.g., phone_norm too short)
      return res.status(400).json({ error: "Invalid phone number (too short after normalization)" });
    }
    if (err.code === "23505") {
      // UNIQUE violation (tenant+email or tenant+phone_norm)
      return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
    }
    return res.status(500).json({ error: "Failed to create lead" });
  } finally {
    client.release();
  }
});

/* ---------------- PATCH /api/leads/:id ---------------- */
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  const patch = req.body || {};

  const fields = [];
  const vals = [];
  let i = 0;

  const allow = {
    status: "status",
    stage: "stage",
    owner_id: "owner_id",
    priority: "priority",
    score: "score",
    ai_summary: "ai_summary",
    ai_next: "ai_next",
  };

  for (const [k, col] of Object.entries(allow)) {
    if (patch[k] !== undefined) {
      fields.push(`${col} = $${++i}`);
      vals.push(col === "ai_next" && Array.isArray(patch[k]) ? JSON.stringify(patch[k]) : patch[k]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: "No updatable fields" });

  const whereVals = [id, tenantId];
  let whereSQL = `WHERE id = $${++i} AND tenant_id = $${++i}`;
  if (companyId) { whereVals.push(companyId); whereSQL += ` AND company_id::text = $${++i}`; }

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
