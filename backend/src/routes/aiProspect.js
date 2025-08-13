import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getProspectProvider } from "../services/aiProspect/index.js";
import { randomUUID } from "crypto";

const router = express.Router();
const provider = getProspectProvider();

// volatile job map so GET job/events work consistently across providers
const memoryJobs = new Map(); // id -> { id, status, prompt, created_at, importId }

router.post("/ai/prospect/jobs", requireAuth, express.json(), async (req, res) => {
  try {
    const { prompt = "", qty = 25 } = req.body || {};
    if (!prompt || String(prompt).trim().length < 3) {
      return res.status(400).json({ error: "prompt is required (>=3 chars)" });
    }
    const job = await provider.createJob({ prompt: String(prompt), qty: Number(qty) || 25 });

    // persist a mirrored copy for consistent GET semantics
    const now = new Date().toISOString();
    const jobRecord = {
      id: job.id || randomUUID(),
      status: job.status || "running",
      prompt,
      created_at: job.created_at || now,
      importId: job.importId || null,
    };
    memoryJobs.set(jobRecord.id, jobRecord);

    return res.json({ data: jobRecord });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

router.get("/ai/prospect/jobs/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  // try provider first
  const job = (await provider.getJob(id)) || memoryJobs.get(id);
  if (!job) return res.status(404).json({ error: "job not found" });
  // if provider is pdl and returned null, memoryJobs holds the “ready” job
  return res.json({ data: job });
});

router.get("/ai/prospect/jobs/:id/events", requireAuth, async (req, res) => {
  const { id } = req.params;
  const list = await provider.getEvents(id);
  // If PDL path → synthesize a single “ready” event if memory shows ready
  if (!list?.length) {
    const job = memoryJobs.get(id);
    if (job && job.status === "ready" && job.importId) {
      return res.json({ data: [{ ts: job.created_at, type: "ready", data: { importId: job.importId } }] });
    }
  }
  return res.json({ data: list || [] });
});

export default router;
