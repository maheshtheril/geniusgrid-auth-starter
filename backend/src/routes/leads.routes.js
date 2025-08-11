// src/routes/leads.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// ---- tenant helper ----
function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.headers["x-tenant-id"] ||
    req.headers["x-company-id"]
  );
}

async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists for this connection (RLS/GUC)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

// Public probe is mounted in server.js as /api/leads/ping (no cookie)
router.get("/ping", (_req, res) => res.status(200).json({ ok: true }));

// GET /api/leads?page&size&q&status&owner
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size, 10) || 25));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  const owner = (req.query.owner || "").trim();

  const params = [tenantId];
  let where = `WHERE tenant_id = $1`;
  let idx = params.length;

  if (q) {
    params.push(`%${q}%`); idx++;
    where += ` AND (
      name ILIKE $${idx} OR
      company ILIKE $${idx} OR
      email ILIKE $${idx} OR
      phone ILIKE $${idx}
    )`;
  }
  if (status) {
    params.push(status); idx++;
    where += ` AND status = $${idx}`;
  }
  if (owner) {
    params.push(owner); idx++;
    where += ` AND (owner = $${idx} OR owner_id::text = $${idx})`;
  }

  const offset = (page - 1) * size;

  const listSQL = `
    SELECT id, name, company, email, phone, status, owner, score,
           ai_summary, ai_next, updated_at
    FROM leads
    ${where}
    ORDER BY updated_at DESC
    LIMIT ${size} OFFSET ${offset};
  `;
  const countSQL = `SELECT COUNT(*)::int AS total FROM leads ${where};`;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const [list, count] = await Promise.all([
      client.query(listSQL, params),
      client.query(countSQL, params),
    ]);

    const items = list.rows.map((r) => ({
      ...r,
      ai_next: Array.isArray(r.ai_next)
        ? r.ai_next
        : typeof r.ai_next === "string" && r.ai_next.startsWith("[")
        ? JSON.parse(r.ai_next)
        : r.ai_next || [],
    }));

    // return both items and data for maximum FE compatibility
    res.json({ items, data: items, total: count.rows[0].total, page, size });
  } catch (err) {
    console.error("GET /leads error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  } finally {
    client.release();
  }
});

// GET /api/leads/pipelines  -> return { items: [...] } (and data alias)
router.get("/pipelines", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const items = [
    { id: "default", name: "Default Pipeline" },
    { id: "inbound", name: "Inbound" },
    { id: "outbound", name: "Outbound" },
  ];
  res.json({ items, data: items, defaultPipelineId: "default" });
});

// GET /api/leads/stages?pipeline=default  -> return { items: [...] }
router.get("/stages", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const pipeline = (req.query.pipeline || "default").toString();
  // Simple stub; replace with real DB table if you have one
  const items = [
    { id: "new",       key: "new",       name: "New",        order: 1, pipeline },
    { id: "qualified", key: "qualified", name: "Qualified",  order: 2, pipeline },
    { id: "proposal",  key: "proposal",  name: "Proposal",   order: 3, pipeline },
    { id: "won",       key: "won",       name: "Won",        order: 4, pipeline },
    { id: "lost",      key: "lost",      name: "Lost",       order: 5, pipeline },
  ];
  res.json({ items, data: items });
});

// PATCH /api/leads/:id  { status }
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const q = `
      UPDATE leads
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, status, updated_at;
    `;
    const r = await client.query(q, [status, id, tenantId]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("PATCH /leads/:id error:", err);
    res.status(500).json({ error: "Failed to update status" });
  } finally {
    client.release();
  }
});

// POST /api/leads/:id/ai-refresh  (mock AI refresh)
router.post("/:id/ai-refresh", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const { id } = req.params;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const score = Math.floor(50 + Math.random() * 50);
    const ai_summary =
      "Prospect shows moderate intent. Prior interactions indicate interest in a demo within 7 days.";
    const ai_next = [
      "Call within 24 hours to qualify budget & timeline",
      "Send 3-slide micro-deck tailored to use-case",
      "Schedule 20-min discovery with solution engineer",
    ];

    const q = `
      UPDATE leads
      SET score = $1,
          ai_summary = $2,
          ai_next = $3,
          updated_at = NOW()
      WHERE id = $4 AND tenant_id = $5
      RETURNING id, score, ai_summary, ai_next, updated_at;
    `;
    const r = await client.query(q, [
      score,
      ai_summary,
      JSON.stringify(ai_next),
      id,
      tenantId,
    ]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next) ? row.ai_next : JSON.parse(row.ai_next || "[]");
    res.json(row);
  } catch (err) {
    console.error("POST /leads/:id/ai-refresh error:", err);
    res.status(500).json({ error: "AI refresh failed" });
  } finally {
    client.release();
  }
});

export default router;
