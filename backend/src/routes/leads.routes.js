// src/routes/leads.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// ---- tenant helper ----
function getTenantId(req) {
  // prefer what your auth sets on the session; fall back to header
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.headers["x-tenant-id"] ||
    req.headers["x-company-id"]
  );
}

// Quick probe: GET /api/leads/ping
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
    params.push(`%${q}%`);
    idx++;
    where += ` AND (
      name ILIKE $${idx} OR
      company ILIKE $${idx} OR
      email ILIKE $${idx} OR
      phone ILIKE $${idx}
    )`;
  }
  if (status) {
    params.push(status);
    idx++;
    where += ` AND status = $${idx}`;
  }
  if (owner) {
    params.push(owner);
    idx++;
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

  try {
    const [list, count] = await Promise.all([
      pool.query(listSQL, params),
      pool.query(countSQL, params),
    ]);

    const items = list.rows.map((r) => ({
      ...r,
      ai_next: Array.isArray(r.ai_next)
        ? r.ai_next
        : typeof r.ai_next === "string" && r.ai_next.startsWith("[")
        ? JSON.parse(r.ai_next)
        : r.ai_next || [],
    }));

    res.json({ items, total: count.rows[0].total, page, size });
  } catch (err) {
    console.error("GET /leads error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  }
});

// GET /api/leads/pipelines  (stub so the UI has something to render)
router.get("/pipelines", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  // Replace with real data if you have a pipelines table
  res.json([
    { id: "default", name: "Default Pipeline" },
    { id: "inbound", name: "Inbound" },
    { id: "outbound", name: "Outbound" },
  ]);
});

// PATCH /api/leads/:id  { status }
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });

  try {
    const q = `
      UPDATE leads
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, status, updated_at;
    `;
    const r = await pool.query(q, [status, id, tenantId]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("PATCH /leads/:id error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// POST /api/leads/:id/ai-refresh  (mock AI refresh)
router.post("/:id/ai-refresh", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const { id } = req.params;

  try {
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
    const r = await pool.query(q, [
      score,
      ai_summary,
      JSON.stringify(ai_next),
      id,
      tenantId,
    ]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next)
      ? row.ai_next
      : JSON.parse(row.ai_next || "[]");

    res.json(row);
  } catch (err) {
    console.error("POST /leads/:id/ai-refresh error:", err);
    res.status(500).json({ error: "AI refresh failed" });
  }
});

export default router;
