// backend/src/store/ai.prospect.routes.js
import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// GET /api/ai/prospect/ping
router.get("/ping", (_req, res) => res.json({ ok: true }));

// POST /api/ai/prospect/jobs
router.post("/jobs", (req, res) => {
  const id = randomUUID();
  // Return a valid job payload immediately; wire real provider later
  res.status(201).json({
    id,
    status: "queued",      // or "completed" if you want to skip polling
    import_job_id: null,   // fill when you have import items
    provider: "stub",
  });
});

export default router;
