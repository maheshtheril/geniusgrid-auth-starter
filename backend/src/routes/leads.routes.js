// src/routes/leads.routes.js
import express from "express";
const router = express.Router();

router.get("/leads", (req, res) => {
  res.status(200).json({ success: true, data: [], page: 1, size: 5 });
});

export default router;
