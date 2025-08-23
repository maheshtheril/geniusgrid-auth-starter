// routes/leads.calendar.js
import express from "express";
import { pool } from "../db/pool.js"; // adjust import
const router = express.Router();

router.get("/leads/calendar", async (req, res) => {
  try {
    let { start, end, q = "", status, priority, ownerId } = req.query;

    // Normalize dates (accept Z or +offset)
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s) || isNaN(e)) return res.status(400).json({ message: "Invalid start/end" });

    const params = [s.toISOString(), e.toISOString()];
    let where = `followup_at IS NOT NULL AND followup_at >= $1 AND followup_at < $2`;

    if (q) { params.push(`%${q.toLowerCase()}%`);
      where += ` AND (lower(name) LIKE $${params.length} OR lower(company) LIKE $${params.length} OR lower(email) LIKE $${params.length})`;
    }
    if (status){ params.push(status); where+=` AND status = $${params.length}`; }
    if (priority){ params.push(Number(priority)); where+=` AND priority = $${params.length}`; }
    if (ownerId){ params.push(ownerId); where+=` AND owner_id = $${params.length}`; }

    const sql = `
      SELECT id,name,company,email,phone,status,priority,followup_at,created_at,owner_id,owner,${/* optional duration */""}
             COALESCE(duration_min, 45) AS duration_min
      FROM leads
      WHERE ${where}
      ORDER BY followup_at ASC
      LIMIT 2000
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("leads/calendar error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

export default router;
