import express from "express";
import { randomUUID } from "node:crypto";

const router = express.Router();

router.post("/ai/prospect/jobs", (req, res) => {
  const body = req.body || {};
  const prompt = (body.prompt ?? "").toString();
  const n = Math.max(1, Math.min(parseInt(body.count ?? 10, 10) || 10, 200));
  const filters = body.filters || {};

  const items = Array.from({ length: n }, (_, i) => ({
    id: randomUUID(),
    name: `Mock Lead ${i + 1}`,
    company_name: `Mock Company ${((i % 10) + 1)}`,
    email: `lead${i + 1}@example.com`,
    phone: `+1-555-000-${1000 + i}`,
    status: "new",
    stage: "Prospect",
    owner_name: "AI Bot",
    score: Math.floor(Math.random() * 100),
    created_at: new Date().toISOString(),
    _prompt: prompt,
    _filters: filters,
  }));

  return res.status(200).json({
    ok: true,
    jobId: randomUUID(),
    status: "completed",
    items,
    total: items.length,
  });
});

export default router;
