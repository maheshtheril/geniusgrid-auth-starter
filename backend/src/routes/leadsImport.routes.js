// src/routes/leadsImport.routes.js
import express from "express";
import multer from "multer";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { processLeadImportCsv } from "../services/leadsImport.service.js"; // new pipeline only

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/* --------------------------- helpers --------------------------- */
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

// tiny CSV helper (for new export route if you add later)
// const toCsv = (...)

function inlinePhoneToNorm(raw = "") {
  // keep only digits; handle +91/0 prefixes lightly
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // normalize Indian mobiles (example): last 10 digits
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// Basic duplicate finder if services/dupes.js is absent
async function basicFindDuplicateCandidates(client, norm) {
  const email = (norm.email || "").toLowerCase();
  const pnorm = norm.phone_norm || inlinePhoneToNorm(norm.phone || "");
  const params = [];
  let where = `tenant_id = ensure_tenant_scope()`;
  if (email) {
    params.push(email);
    where += ` AND lower(email) = $${params.length}`;
  }
  if (pnorm) {
    params.push(pnorm);
    // compare regexp_replace(phone,'\\D','','g') with normalized digits
    where += email ? ` OR regexp_replace(coalesce(phone,''),'\\D','','g') = $${params.length}` 
                   : ` AND regexp_replace(coalesce(phone,''),'\\D','','g') = $${params.length}`;
  }
  const q = await client.query(
    `SELECT id, name, email, phone FROM public.leads WHERE ${where} LIMIT 5`,
    params
  );
  return q.rows;
}

// Try to use your existing helpers if they exist; otherwise fall back
async function phoneToNormMaybe(raw) {
  try {
    const mod = await import("../services/phone.js");
    return mod.phoneToNorm ? mod.phoneToNorm(raw) : inlinePhoneToNorm(raw);
  } catch { return inlinePhoneToNorm(raw); }
}
async function findDuplicateCandidatesMaybe(client, norm) {
  try {
    const mod = await import("../services/dupes.js");
    if (mod.findDuplicateCandidates) return mod.findDuplicateCandidates(client, norm);
  } catch {}
  return basicFindDuplicateCandidates(client, norm);
}
async function aiSummarizeMaybe(arg) {
  try {
    const mod = await import("../services/ai.js");
    if (mod.aiSummarizeLead) return mod.aiSummarizeLead(arg);
  } catch {}
}
async function aiScoreMaybe(arg) {
  try {
    const mod = await import("../services/ai.js");
    if (mod.aiScoreLead) return mod.aiScoreLead(arg);
  } catch {}
}

/* =================== NEW PIPELINE (job-based) =================== */
/**
 * POST /api/leads/imports
 * form-data: file (CSV), options (JSON string, optional)
 */
router.post("/leads/imports", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const tenantId = getTenant(req);
    const userId = getUser(req);
    if (!tenantId) return res.status(400).json({ message: "Missing tenant" });
    if (!req.file?.buffer) return res.status(400).json({ message: "CSV file is required (field name: file)" });

    let options = {};
    if (req.body?.options) { try { options = JSON.parse(req.body.options); } catch {} }

    const job = await processLeadImportCsv({
      tenantId,
      userId,
      filename: req.file.originalname || "upload.csv",
      buffer: req.file.buffer,
      options,
    });

    res.json({ data: job });
  } catch (err) { next(err); }
});

/** GET /api/leads/imports/:id */
router.get("/leads/imports/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const q = await pool.query(
      `SELECT * FROM public.import_jobs WHERE id=$1 AND tenant_id=ensure_tenant_scope()`,
      [id]
    );
    if (q.rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json({ data: q.rows[0] });
  } catch (err) { next(err); }
});

/** GET /api/leads/imports/:id/rows?outcome=failed|duplicate|inserted&limit=50&offset=0 */
router.get("/leads/imports/:id/rows", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { outcome, limit = 50, offset = 0 } = req.query;

    const params = [id, Number(limit), Number(offset)];
    let where = `job_id=$1 AND tenant_id=ensure_tenant_scope()`;
    if (outcome) { params.push(outcome); where += ` AND outcome = $4`; }

    const rowsQ = await pool.query(
      `SELECT id, row_no, input_json, outcome, error_text, lead_id, created_at
         FROM public.import_job_rows
        WHERE ${where}
        ORDER BY row_no ASC
        LIMIT $2 OFFSET $3`,
      params
    );
    res.json({ data: rowsQ.rows });
  } catch (err) { next(err); }
});

/* ============== LEGACY PIPELINE (optional deps) ================= */
/** POST /api/imports */
router.post("/imports", requireAuth, async (req, res, next) => {
  try {
    const { filename, options } = req.body || {};
    const { rows } = await pool.query(
      `INSERT INTO public.lead_imports (tenant_id, created_by, filename, options)
       VALUES (ensure_tenant_scope(), $1, $2, $3) RETURNING *`,
      [getUser(req), filename || "upload.csv", options || {}]
    );
    res.json({ ok: true, import: rows[0] });
  } catch (e) { next(e); }
});

/** POST /api/imports/:id/parse */
router.post("/imports/:id/parse", requireAuth, upload.single("file"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const importId = req.params.id;
    if (!req.file) return res.status(400).json({ message: "file required" });

    // lazy-load papaparse only here
    const Papa = (await import("papaparse")).default;

    const text = req.file.buffer.toString("utf8");
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data || [];
    let total = 0, invalid = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      total++;
      const name    = (r.name || r.full_name || r.lead || "").toString().trim();
      const email   = (r.email || "").toString().trim();
      const phone   = (r.phone || r.mobile || "").toString().trim();
      const company = (r.company || r.organization || "").toString().trim();
      const phone_norm = await phoneToNormMaybe(phone);

      const norm = { name, email: email || null, phone: phone || null, phone_norm, company };
      const errors = [];
      if (!name) errors.push("name required");

      const dup_candidates = await findDuplicateCandidatesMaybe(client, norm);

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
         total_rows=$2, invalid_rows=$3, valid_rows=($2-$3),
         status='ready', updated_at=NOW()
       WHERE id=$1 AND tenant_id=ensure_tenant_scope()`,
      [importId, total, invalid]
    );

    await client.query("COMMIT");
    res.json({ ok: true, import_id: importId, total, invalid });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    next(e);
  } finally { client.release(); }
});

/** POST /api/imports/:id/commit */
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

    const { rows: items } = await client.query(
      `SELECT id, norm, dup_candidates
         FROM public.lead_import_items
        WHERE import_id=$1 AND tenant_id=ensure_tenant_scope()
          AND COALESCE(array_length(errors,1),0)=0`,
      [importId]
    );

    const createdIds = [];
    for (const it of items) {
      const n = it.norm || {};
      const { rows: ins } = await client.query(
        `INSERT INTO public.leads
           (tenant_id, name, email, phone, company, source, status, stage, created_at)
         VALUES (ensure_tenant_scope(), $1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [n.name, n.email, n.phone, n.company, default_source, default_status, default_stage]
      );
      if (ins.length) createdIds.push(ins[0].id);
    }

    await client.query(
      `UPDATE public.lead_imports
          SET status='done', updated_at=NOW()
        WHERE id=$1 AND tenant_id=ensure_tenant_scope()`,
      [importId]
    );

    await client.query("COMMIT");

    if (ai_enrich && createdIds.length) {
      setImmediate(async () => {
        for (const id of createdIds) {
          try {
            await aiSummarizeMaybe({ id });
            await aiScoreMaybe({ id });
          } catch {}
        }
      });
    }

    res.json({ ok: true, created: createdIds.length, created_ids: createdIds });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    next(e);
  } finally { client.release(); }
});

export default router;
