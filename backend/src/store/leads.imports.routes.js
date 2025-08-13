// src/routes/leads.imports.routes.js
import express from "express";
import { IMPORTS } from "../store/prospect.store.js";

const router = express.Router();

/* GET /api/leads/imports/:id/items?limit=5 */
router.get("/:id/items", (req, res) => {
  const items = IMPORTS.get(req.params.id) || [];
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 500));
  res.json(items.slice(0, limit));
});

export default router;
