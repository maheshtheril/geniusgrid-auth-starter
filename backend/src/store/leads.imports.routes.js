// src/store/leads.imports.routes.js
import express from "express";
import { IMPORTS } from "./prospect.store.js";

const router = express.Router();

/**
 * GET /api/leads/imports/:id/items
 * Query: limit (1..500), offset (>=0)
 * Returns: array of items for preview/review
 */
router.get("/:id/items", (req, res) => {
  const importId = req.params.id;
  const list = IMPORTS.get(importId) || [];

  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 500));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  const slice = list.slice(offset, offset + limit);
  return res.json(slice);
});

/**
 * Optional helpers
 *  - GET /api/leads/imports/:id/count -> { total }
 *  - GET /api/leads/imports/:id/meta  -> { id, total, hasItems }
 */
router.get("/:id/count", (req, res) => {
  const list = IMPORTS.get(req.params.id) || [];
  return res.json({ total: list.length });
});

router.get("/:id/meta", (req, res) => {
  const list = IMPORTS.get(req.params.id) || [];
  return res.json({ id: req.params.id, total: list.length, hasItems: list.length > 0 });
});

export default router;
