
// Minimal public Import Items stub (reads from in-memory IMPORTS)
import express from "express";
import { IMPORTS } from "./ai.prospect.routes.js";

const router = express.Router();

router.get("/leads/imports/:importId/items", (req, res) => {
  const { importId } = req.params;
  const limit = Math.max(1, Math.min(parseInt(req.query.limit ?? 5, 10) || 5, 200));

  const bag = IMPORTS.get(importId);
  if (!bag) return res.json([]);

  const items = Array.isArray(bag.items) ? bag.items.slice(0, limit) : [];
  res.json(items);
});

export default router;

