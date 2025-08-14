// Minimal, robust endpoints for AI prospect jobs.
// Works immediately; wire real provider calls later.
import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// Health
router.get("/ai/prospect/ping", (_req, res) => res.json({ ok: true }));

// Create a job (always returns JSON)
router.post("/ai/prospect/jobs", async (req, res) => {
  try {
    const id = randomUUID();
    // TODO: queue/provider call here
    return res.status(201).json({
      id,
      status: "queued",      // flip to "completed" if you prefer
      import_job_id: null,   // set real import id when available
      provider: "stub",
    });
  } catch (err) {
    console.error("POST /ai/prospect/jobs failed:", err);
    return res.status(500).json({
      error: "create_job_failed",
      detail: err?.message || String(err),
    });
  }
});

// Job status
router.get("/ai/prospect/jobs/:id", (req, res) => {
  res.json({
    id: req.params.id,
    status: "completed",   // pretend it finished
    import_job_id: null,   // put a real id when you have imports
  });
});

// Job events
router.get("/ai/prospect/jobs/:id/events", (_req, res) => {
  res.json([]);            // empty array for now
});

export default router;
