import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getProspectProvider } from "../services/aiProspect/index.js";

const router = express.Router();
const provider = getProspectProvider();

router.get("/leads/imports/:id/items", requireAuth, async (req, res) => {
  const { id } = req.params;
  const imp = await provider.getImport(id);
  if (!imp) return res.status(404).json({ error: "import not found" });
  return res.json({ data: imp.items || [] });
});

router.post("/leads/imports/:id/commit", requireAuth, async (req, res) => {
  const { id } = req.params;
  const summary = await provider.commitImport(id);
  return res.json({ data: summary });
});

export default router;
