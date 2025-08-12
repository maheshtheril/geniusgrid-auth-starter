// src/routes/leadsImport.routes.js
import express from "express";
import multer from "multer";
import { processLeadImportCsv } from "../services/leadsImport.service.js";
import { pool } from "../db/pool.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function getTenant(req) {
  return req.session?.tenantId || req.session?.tenant_id;
}
function getUser(req) {
  return req.session?.user?.id || req.session?.user_id || null;
}

/**
 * POST /api/leads/imports
 * form-data:
 *  - file: CSV
 *  - options: JSON string (optional)
 */
router.post("/leads/imports", upload.single("file"), async (req, res, next) => {
  try {
    const tenantId = getTenant(req);
    if (!tenantId) return res.status(400).json({ message: "Missing tenant" });

    if (!req.file?.buffer) return res.status(400).json({ message: "CSV file is required (field name: file)" });

    let options = {};
    if (req.body?.options) {
      try { options = JSON.parse(req.body.options); } catch {}
    }

    const job = await processLeadImportCsv({
      tenantId,
      userId: getUser(req),
      filename: req.file.originalname || "upload.csv",
      buffer: req.file.buffer,
      options,
    });

    res.json({ data: job });
  } catch (err) {
    next(err);
  }
});

/** GET /api/leads/imports/:id – job status */
router.get("/leads/imports/:id", async (req, res, next) => {
  try {
    const tenantId = getTenant(req);
    const { id } = req.params;
    const q = await pool.query(
      `SELECT *
         FROM public.import_jobs
        WHERE id=$1 AND tenant_id=ensure_tenant_scope()`,
      [id]
    );
    if (q.rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json({ data: q.rows[0] });
  } catch (err) {
    next(err);
  }
});

/** GET /api/leads/imports/:id/rows?outcome=failed|duplicate|inserted&limit=50&offset=0 */
router.get("/leads/imports/:id/rows", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { outcome, limit = 50, offset = 0 } = req.query;

    const params = [id, Number(limit), Number(offset)];
    let where = `job_id = $1 AND tenant_id = ensure_tenant_scope()`;
    if (outcome) {
      params.push(outcome);
      where += ` AND outcome = $4`;
    }

    const rowsQ = await pool.query(
      `SELECT id, row_no, input_json, outcome, error_text, lead_id, created_at
         FROM public.import_job_rows
        WHERE ${where}
        ORDER BY row_no ASC
        LIMIT $2 OFFSET $3`,
      params
    );
    res.json({ data: rowsQ.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
