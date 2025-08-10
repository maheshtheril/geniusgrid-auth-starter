// src/routes/csrf.routes.js
import express from "express";
import { csrfProtection } from "../middleware/csrf.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
router.get("/token", requireAuth, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
export default router;