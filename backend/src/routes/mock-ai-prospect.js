// ESM, no external deps
import express from "express";
import { randomUUID } from "node:crypto";

const router = express.Router();

router.post("/ai/prospect/jobs", (req, res) => {
  const { prompt, count = 10, filters = {} } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ ok: false, error: "prompt is required" });
  }

  const jobId = randomUUID();
  const n = Math.max(1, Math.min(Number(count) || 10, 200));

  const leads = Array.from({ length: n }, (_, i) => ({
    id: randomUUID(),
    name: `Mock Lead ${i + 1}`,
    company_name: `Mock Company ${((i % 10) + 1)}`,
    email: `lead${i + 1}@example.com`,
    phone: `+1-555-000-${String(1000 + i)}`,
    status: "new",
    stage: "Prospect",
    owner_name: "AI Bot",
    score: Math.floor(Math.random() * 100),
    created_at: new Date().toISOString(),
    _filters: filters,
    _prompt: prompt,
  }));

  return res.json({
    ok: true,
    jobId,
    status: "completed",
    items: leads,
    total: leads.length,
  });
});

export default router;
