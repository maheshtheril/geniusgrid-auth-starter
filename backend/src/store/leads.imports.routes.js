// backend/src/store/leads.imports.routes.js
import express from "express";
import { __getImport } from "./ai.prospect.routes.js";

const router = express.Router();

// GET /api/leads/imports/:importId/items?limit=5
router.get("/:importId/items", (req, res) => {
  const rec = __getImport(req.params.importId);
  if (!rec) return res.status(404).json({ message: "Import not found" });
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 200));
  res.json(rec.items.slice(0, limit));
});

export default router;
