// src/routes/leadsImport.routes.js
import express from "express";
import multer from "multer";
import Papa from "papaparse";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

// Legacy helpers/services
import { phoneToNorm } from "../services/phone.js";
import { findDuplicateCandidates } from "../services/dupes.js";
import { aiScoreLead, aiSummarizeLead } from "../services/ai.js";

// New pipeline service
import { processLeadImportCsv } from "../services/leadsImport.service.js";

const router = express.Router();

// One multer for all endpoints (memory storage, 20MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

/* -----------------------------------------------------------
   Helpers to read tenant/user (works with requireAuth + session)
----------------------------------------------------------- */
function getTenant(req) {
  return (
    req.user?.tenant_id ||
    req.user?.tenantId ||
    req.session?.tenantId ||
    req.session?.tenant_id ||
    null
  );
}
function getUser(req) {
  return req.user?.id || req.session?.user?.id || req.session?.user_id || null;
}

/* ===========================================================
   NEW PIPELINE (job-based) — Tables: import_jobs / import_job_rows
   Paths: /leads/imports, /leads/imports/:id, /leads/imports/:id/rows
=========================================================== */

/**
 * POST /api/leads/imports
 * form-data:
 *  - file: CSV
 *  - options: JSON string (optional)
 */
router.post(
  "/leads/imports",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const tenantId = getTenant(req);
      const userId = getUser(req);
      if (!tenantId) return res.status(400).json({ message: "Missing tenant" });
      if (!req.file?.buffer)
        return res
          .status(400)
          .json({ message: "CSV file is required (field name: file)" });

      let options = {};
      if (req.body?.options) {
        try {
          options = JSON.parse(req.body.options);
        } catch {
          // ignore bad options JSON; service may handle defaults
        }
      }

      const job = await processLeadImportCsv({
        tenantId,
        userId,
        filename: req.file.originalname || "upload.csv",
        buffer: req.file.buffer,
        options,
      });

      res.json({ data: job });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/leads/imports/:id – job status */
router.get("/leads/imports/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await pool.query(
      `SELECT *
         FROM public.import_jobs
        WHERE id = $1 AND tenant_id = ensure_tenant_scope()`,
      [id]
    );
    if (q.rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json({ data: q.rows[0] });
  } catch (err) {
    next(err);
  }
});

/** GET /api/leads/imports/:id/rows?outcome=failed|duplicate|inserted&limit=50&offset=0 */
router.get("/leads/imports/:id/rows", requireAuth, async (req, res, next) => {
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

/* ===========================================================
   LEGACY PIPELINE (table-per-import) — Tables:
   lead_imports / lead_import_items → commit to leads
   Paths: /imports, /imports/:id/parse, /imports/:id/commit
=========================================================== */

/** POST /api/imports — create legacy import header */
router.post("/imports", requireAuth, async (req, res, next) => {
  try {
    const { filename, options } = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO public.lead_imports (tenant_id, created_by, filename, options)
       VALUES (ensure_tenant_scope(), $1, $2, $3)
       RETURNING *`,
      [getUser(req), filename || "upload.csv", options || {}]
    );
    res.json({ ok: true, import: rows[0] });
  } catch (e) {
    next(e);
  }
});

/** POST /api/imports/:id/parse — upload + parse rows into lead_import_items */
router.post(
  "/imports/:id/parse",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const importId = req.params.id;
      const file = req.file;
      if (!file) return res.status(400).json({ message: "file required" });

      // parse CSV
      const text = file.buffer.toString("utf8");
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = parsed.data || [];
      let total = 0,
        invalid = 0;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        total++;
        const name = (r.name || r.full_name || r.lead || "").toString().trim();
        const email = (r.email || "").toString().trim();
        const phone = (r.phone || r.mobile || "").toString().trim();
        const company = (r.company || r.organization || "").toString().trim();
        const phone_norm = phoneToNorm(phone);

        const norm = {
          name,
          email: email || null,
          phone: phone || null,
          phone_norm,
          company,
        };
        const errors = [];
        if (!name) errors.push("name required");

        // pre-dupe candidates
        const dup_candidates = await findDuplicateCandidates(client, norm);

        await client.query(
          `INSERT INTO public.lead_import_items
             (tenant_id, import_id, row_num, raw, norm, errors, dup_candidates)
           VALUES (ensure_tenant_scope(), $1, $2, $3, $4, $5, $6)`,
          [importId, i + 1, r, norm, errors, dup_candidates]
        );
        if (errors.length) invalid++;
      }

      await client.query(
        `UPDATE public.lead_imports SET
           total_rows = $2,
           invalid_rows = $3,
           valid_rows = ($2 - $3),
           status = 'ready',
           updated_at = NOW()
         WHERE id = $1
           AND tenant_id = ensure_tenant_scope()`,
        [importId, total, invalid]
      );

      await client.query("COMMIT");
      res.json({ ok: true, import_id: importId, total, invalid });
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      next(e);
    } finally {
      client.release();
    }
  }
);

/** POST /api/imports/:id/commit — insert valid items into leads (with optional AI) */
router.post("/imports/:id/commit", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const importId = req.params.id;
    const {
      default_stage = "new",
      default_status = "new",
      default_source = "Import",
      ai_enrich = true,
    } = req.body || {};

    // pick items with no errors
    const { rows: items } = await client.query(
      `SELECT id, norm, dup_candidates
         FROM public.lead_import_items
        WHERE import_id = $1
          AND tenant_id = ensure_tenant_scope()
          AND COALESCE(array_length(errors,1),0) = 0`,
      [importId]
    );

    const createdIds = [];

    for (const it of items) {
      const n = it.norm || {};
      // exact dup guard via unique indexes; try insert
      const { rows: ins } = await client.query(
        `INSERT INTO public.leads
           (tenant_id, name, email, phone, company, source, status, stage, created_at)
         VALUES (ensure_tenant_scope(), $1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          n.name,
          n.email,
          n.phone,
          n.company,
          default_source,
          default_status,
          default_stage,
        ]
      );
      if (ins.length) {
        createdIds.push(ins[0].id);
      } else {
        // (optional) could auto-merge here with best dup candidate
      }
    }

    await client.query(
      `UPDATE public.lead_imports
          SET status='done', updated_at = NOW()
        WHERE id = $1
          AND tenant_id = ensure_tenant_scope()`,
      [importId]
    );

    await client.query("COMMIT");

    // AI enrich (fire-and-forget)
    if (ai_enrich && createdIds.length) {
      setImmediate(async () => {
        for (const id of createdIds) {
          try {
            await aiSummarizeLead({ id });
            await aiScoreLead({ id });
          } catch {
            // ignore AI errors
          }
        }
      });
    }

    res.json({ ok: true, created: createdIds.length, created_ids: createdIds });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    next(e);
  } finally {
    client.release();
  }
});

export default router;
