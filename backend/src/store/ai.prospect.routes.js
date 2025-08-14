
// Minimal public AI prospect stub (no DB, no auth)
import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// In-memory stores
const JOBS = new Map();     // jobId -> { id, status, import_job_id, events: [] }
const IMPORTS = new Map();  // importId -> { id, items: [] }

function makeItems(n = 5) {
  const base = [
    { name: "Priya Sharma",  title: "Procurement Manager", company: "Aarav Auto Components Pvt Ltd", email: "priya.sharma@aaravauto.in" },
    { name: "Rohan Iyer",    title: "Finance Controller",  company: "Kaveri Textiles Ltd",           email: "rohan.iyer@kaveritextiles.in" },
    { name: "Neha Gupta",    title: "Operations Head",     company: "Vistara Foods Pvt Ltd",         email: "neha.gupta@vistarafoods.in" },
    { name: "Arjun Mehta",   title: "Supply Chain Lead",   company: "Indus Machinery Works",         email: "arjun.mehta@indusmw.in" },
    { name: "Ananya Rao",    title: "Plant Admin",         company: "Sahyadri Ceramics",             email: "ananya.rao@sahyadri-ceramics.in" },
  ];
  const items = [];
  for (let i = 0; i < n; i++) {
    const t = base[i % base.length];
    items.push({ id: randomUUID(), ...t });
  }
  return items;
}

// Health
router.get("/ai/prospect/ping", (_req, res) => res.json({ ok: true }));

// Create job
router.post("/ai/prospect/jobs", (req, res) => {
  const prompt = String(req.body?.prompt ?? "");
  const size = Math.max(1, Math.min(parseInt(req.body?.size ?? 10, 10) || 10, 200));

  const jobId = randomUUID();
  const importId = randomUUID();
  const now = Date.now();

  const events = [
    { id: randomUUID(), ts: new Date(now).toISOString(),       level: "info",    message: "Queued: discovering" },
    { id: randomUUID(), ts: new Date(now + 400).toISOString(), level: "info",    message: `Running: prompt "${prompt.slice(0,60)}"` },
    { id: randomUUID(), ts: new Date(now + 900).toISOString(), level: "success", message: "Completed" },
  ];

  // create items & persist in-memory
  const items = makeItems(size);
  IMPORTS.set(importId, { id: importId, items });

  // save job as completed
  JOBS.set(jobId, { id: jobId, status: "completed", import_job_id: importId, events });

  return res.status(201).json({ id: jobId, status: "completed", import_job_id: importId, provider: "stub" });
});

// Job status
router.get("/ai/prospect/jobs/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ message: "Not Found" });
  res.json({ id: job.id, status: job.status, import_job_id: job.import_job_id, provider: "stub" });
});

// Job events (ignores ?since for simplicity)
router.get("/ai/prospect/jobs/:id/events", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.json([]);
  res.json(job.events || []);
});

export { IMPORTS };
export default router;

