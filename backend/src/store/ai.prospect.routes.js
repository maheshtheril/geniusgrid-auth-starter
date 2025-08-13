// src/routes/ai.prospect.routes.js
import express from "express";
import { JOBS, EVENTS, IMPORTS, uid, pushEvent, setStatus, attachImport } from "../store/prospect.store.js";

const router = express.Router();

// Simple mock lead generator (replace later with real PDL results)
function makeLeads(count = 10) {
  const base = [
    { name: "Priya Sharma",  title: "Procurement Manager", company: "Aarav Auto Components Pvt Ltd", email: "priya.sharma@aaravauto.in" },
    { name: "Rohan Iyer",    title: "Finance Controller",  company: "Kaveri Textiles Ltd",          email: "rohan.iyer@kaveritextiles.in" },
    { name: "Neha Gupta",    title: "Operations Head",      company: "Vistara Foods Pvt Ltd",        email: "neha.gupta@vistarafoods.in" },
    { name: "Arjun Mehta",   title: "Supply Chain Lead",    company: "Indus Machinery Works",        email: "arjun.mehta@indusmw.in" },
    { name: "Ananya Rao",    title: "Plant Admin",          company: "Sahyadri Ceramics",            email: "ananya.rao@sahyadri-ceramics.in" },
  ];
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = base[i % base.length];
    out.push({ id: `${String(i + 1).padStart(3, "0")}`, ...t });
  }
  return out;
}

// Fire-and-forget worker that simulates provider + import
async function runProspectJob(jobId, payload) {
  try {
    setStatus(jobId, "running");
    pushEvent(jobId, "info", "Starting provider query…");

    // TODO: call your real PDL path here with payload
    await new Promise((r) => setTimeout(r, 500));
    pushEvent(jobId, "info", "Enriching results…");

    // Create an import with mock items so the UI preview works now
    const importId = uid();
    const size = Math.max(5, Math.min(Number(payload?.size) || 50, 200));
    IMPORTS.set(importId, makeLeads(size));

    attachImport(jobId, importId);
    pushEvent(jobId, "success", "Completed");
    setStatus(jobId, "completed");
  } catch (err) {
    pushEvent(jobId, "error", err?.message || "Job failed");
    setStatus(jobId, "failed");
  }
}

/* POST /api/ai/prospect/jobs  {prompt,size,providers,filters} */
router.post("/jobs", (req, res) => {
  const { prompt, size = 50, providers = ["pdl"], filters = {} } = req.body || {};
  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "prompt is required" });

  const id = uid();
  const job = { id, status: "queued", import_job_id: null, created_at: new Date().toISOString() };
  JOBS.set(id, job);
  EVENTS.set(id, []);
  pushEvent(id, "info", "Queued");

  setImmediate(() => runProspectJob(id, { prompt, size, providers, filters }));
  res.json(job);
});

/* GET /api/ai/prospect/jobs/:id */
router.get("/jobs/:id", (req, res) => {
  const j = JOBS.get(req.params.id);
  if (!j) return res.status(404).json({ error: "Job not found" });
  res.json(j);
});

/* GET /api/ai/prospect/jobs/:id/events?since=ISO */
router.get("/jobs/:id/events", (req, res) => {
  const arr = EVENTS.get(req.params.id) || [];
  const { since } = req.query;
  if (!since) return res.json(arr);
  res.json(arr.filter((e) => e.ts > since));
});

export default router;
