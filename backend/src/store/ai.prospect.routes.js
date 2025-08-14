// Live PDL-backed prospecting with a tiny in-memory job/import store.
import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// In-memory stores (ephemeral)
const JOBS = new Map();     // jobId -> { id, status, import_job_id, provider, events: [], created_at }
const IMPORTS = new Map();  // importId -> { id, items: [], created_at }

// Helpers
const nowISO = () => new Date().toISOString();

function addEvent(job, level, message) {
  const e = { id: randomUUID(), ts: nowISO(), level, message };
  job.events.push(e);
  return e;
}

function mapPDLItems(pdlJson = {}) {
  // PDL person/search often returns { data: [ { full_name, job_title, job_company_name, emails, work_email, ... } ] }
  const arr = Array.isArray(pdlJson.data) ? pdlJson.data : [];
  return arr.slice(0, 200).map((p, i) => ({
    id: p.id || p.pid || `${Date.now()}-${i}`,
    name: p.full_name || p.name || "-",
    title: p.job_title || p.title || "-",
    company: p.job_company_name || p.organization || p.company || "-",
    email:
      p.work_email ||
      (Array.isArray(p.emails) && p.emails.length ? p.emails[0] : null) ||
      "-",
  }));
}

async function fetchPDL(prompt, size) {
  const key = process.env.PDL_API_KEY?.trim();
  if (!key) throw new Error("Missing PDL_API_KEY");

  // People Data Labs person search (basic full-text). Node 20 has global fetch.
  const url = "https://api.peopledatalabs.com/v5/person/search";
  const body = {
    query: prompt,
    size: Math.max(1, Math.min(Number(size) || 25, 200)),
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": key,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`PDL ${r.status}: ${txt || r.statusText}`);
  }
  return r.json();
}

// Health
router.get("/ping", (_req, res) => res.json({ ok: true }));

// Create job
router.post("/jobs", async (req, res) => {
  const { prompt = "", size = 50 } = req.body || {};
  const id = randomUUID();
  const job = {
    id,
    status: "queued",
    import_job_id: null,
    provider: "pdl",
    events: [],
    created_at: nowISO(),
  };
  JOBS.set(id, job);

  addEvent(job, "info", "Queued job");
  res.status(201).json({
    id: job.id,
    status: job.status,
    import_job_id: job.import_job_id,
    provider: job.provider,
  });

  // run async so the HTTP response returns immediately
  (async () => {
    try {
      job.status = "running";
      addEvent(job, "info", "Calling PDL…");
      const pdlJson = await fetchPDL(String(prompt).trim(), size);
      addEvent(
        job,
        "success",
        `PDL returned ${Array.isArray(pdlJson?.data) ? pdlJson.data.length : 0} results`
      );

      const items = mapPDLItems(pdlJson);
      const importId = randomUUID();
      IMPORTS.set(importId, { id: importId, items, created_at: nowISO() });
      job.import_job_id = importId;

      addEvent(job, "info", `Prepared ${items.length} items for preview/import`);
      job.status = "completed";
      addEvent(job, "success", "Job completed");
    } catch (err) {
      job.status = "failed";
      addEvent(job, "error", `Failed: ${err?.message || String(err)}`);
    }
  })().catch(() => {});
});

// Job status
router.get("/jobs/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    import_job_id: job.import_job_id,
    provider: job.provider,
    created_at: job.created_at,
  });
});

// Job events (supports ?since=ISO)
router.get("/jobs/:id/events", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ message: "Job not found" });

  const since = req.query.since ? Date.parse(String(req.query.since)) : null;
  const out = since
    ? job.events.filter((e) => Date.parse(e.ts) > since)
    : job.events;
  res.json(out);
});

// Export a helper the imports router can read (same process)
export function __getImport(importId) {
  return IMPORTS.get(importId);
}

export default router;
