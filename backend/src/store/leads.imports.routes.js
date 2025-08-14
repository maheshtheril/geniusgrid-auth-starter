import express from "express";
import { __getImport } from "./ai.prospect.routes.js";

const router = express.Router();

// GET /api/leads/imports/:id
router.get("/:id", (req, res) => {
  const imp = __getImport(req.params.id);
  if (!imp) return res.status(404).json({ message: "Import not found" });
  res.json({ id: imp.id, total: imp.items.length, created_at: imp.created_at });
});

// GET /api/leads/imports/:id/items?limit=5&offset=0
router.get("/:id/items", (req, res) => {
  const imp = __getImport(req.params.id);
  if (!imp) return res.status(404).json({ message: "Import not found" });

  const total = imp.items.length;
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || "50", 10), 200));
  const offset = Math.max(0, parseInt(req.query.offset || "0", 10));
  const slice = imp.items.slice(offset, offset + limit);

  res.json({ items: slice, total, limit, offset });
});

export default router;
