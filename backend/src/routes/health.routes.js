// src/routes/health.routes.js
import express from "express";
import { pool } from "../db/pool.js";
const router = express.Router();

router.get("/health", (_req, res) => res.status(200).json({ ok: true }));
router.get("/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
export default router;