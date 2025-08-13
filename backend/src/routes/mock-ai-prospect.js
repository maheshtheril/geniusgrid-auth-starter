// mock-ai-prospect.js
import express from "express";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.post("/ai/prospect/jobs", (req, res) => {
  const { prompt, count = 10, filters = {} } = req.body || {};

  // basic input check to avoid frontend infinite loaders
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  // mock job ID
  const jobId = uuidv4();

  // mock leads array
  const leads = Array.from({ length: count }, (_, i) => ({
    id: uuidv4(),
    name: `Mock Lead ${i + 1}`,
    company: `Mock Company ${Math.ceil(Math.random() * 10)}`,
    email: `lead${i + 1}@example.com`,
    phone: `+1-555-000-${String(1000 + i)}`,
    status: "New",
    aiScore: Math.floor(Math.random() * 100),
    filtersApplied: filters,
    promptUsed: prompt
  }));

  res.json({
    jobId,
    status: "completed",
    leads
  });
});

export default router;
