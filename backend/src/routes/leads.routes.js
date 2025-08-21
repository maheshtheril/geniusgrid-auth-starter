// src/routes/leads.routes.js
// Endpoints:
//   GET    /api/leads/ping
//   GET    /api/leads                 list (filters + paging)
//   GET    /api/leads/pipelines       distinct stages (array)
//   GET    /api/leads/stages          alias of pipelines
//   GET    /api/leads/check-mobile    (?phone= or ?mobile=)
//   POST   /api/leads                 create lead (multipart or JSON; inserts CFV rows)
//   GET    /api/leads/:id             fetch one lead (tenant/company scoped)
//   PATCH  /api/leads/:id             update (MASTER FIELDS enabled)

import express from "express";
import multer from "multer";
import { pool } from "../db/pool.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

/* ---------------- helpers ---------------- */
function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}
function getCompanyId(req) {
  return (
    req.session?.companyId ||
    req.session?.company_id ||
    req.get("x-company-id") ||
    req.query.company_id ||
    null
  );
}
async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists on this connection (for ensure_tenant_scope() + RLS)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* ---------------- probe ---------------- */
router.get("/ping", (_req, res) => res.json({ ok: true }));

/* ---------------- GET /api/leads (list) ---------------- */
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? req.query.size, 10) || 25));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  const stage = (req.query.stage || "").trim();
  const owner_id = (req.query.owner_id || "").trim();

  const params = [tenantId];
  let where = `WHERE tenant_id = $1`;
  let i = params.length;

  if (companyId) { params.push(companyId); where += ` AND company_id::text = $${++i}`; }
  if (q)         { params.push(`%${q}%`);  where += ` AND (name ILIKE $${++i} OR company ILIKE $${i} OR email ILIKE $${i} OR phone ILIKE $${i})`; }
  if (status)    { params.push(status);    where += ` AND status = $${++i}`; }
  if (stage)     { params.push(stage);     where += ` AND stage  = $${++i}`; }
  if (owner_id)  { params.push(owner_id);  where += ` AND owner_id::text = $${++i}`; }

  const offset = (page - 1) * size;

  const listSQL = `
    SELECT
      id,
      tenant_id,
      company_id,
      owner_id,
      name,
      company AS company_name,
      email,
      phone,
      website,
      source,
      status,
      stage,
      owner   AS owner_name,
      score,
      priority,
      tags_text,
      followup_at,
      created_at,
      updated_at,
      ai_summary,
      ai_next,
      ai_score,
      ai_next_action
    FROM public.leads
    ${where}
    ORDER BY updated_at DESC
    LIMIT ${size} OFFSET ${offset};
  `;
  const countSQL = `SELECT COUNT(*)::int AS total FROM public.leads ${where};`;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const [list, count] = await Promise.all([
      client.query(listSQL, params),
      client.query(countSQL, params),
    ]);

    const items = (list.rows || []).map((r) => ({
      ...r,
      ai_next: Array.isArray(r.ai_next)
        ? r.ai_next
        : typeof r.ai_next === "string" && r.ai_next.startsWith("[")
          ? JSON.parse(r.ai_next)
          : r.ai_next || [],
    }));

    res.json({ items, total: count.rows?.[0]?.total ?? 0, page, size });
  } catch (err) {
    console.error("GET /leads error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  } finally {
    client.release();
  }
});

/* ---------------- Distinct stages helper + routes ---------------- */
async function loadStageList(tenantId, companyId) {
  const params = [tenantId];
  let where = `WHERE tenant_id = $1 AND stage IS NOT NULL AND stage <> ''`;
  let j = params.length;

  if (companyId) { params.push(companyId); where += ` AND company_id::text = $${++j}`; }

  const { rows } = await pool.query(
    `SELECT DISTINCT stage FROM public.leads ${where} ORDER BY stage ASC`,
    params
  );
  const stages = rows.map((r) => r.stage).filter(Boolean);
  return stages.length ? stages : ["new", "qualified", "proposal", "won", "lost"];
}

router.get("/pipelines", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  try {
    const stages = await loadStageList(tenantId, getCompanyId(req));
    res.json(stages);
  } catch (err) {
    console.error("GET /leads/pipelines error:", err);
    res.json(["new", "qualified", "proposal", "won", "lost"]);
  }
});

router.get("/stages", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  try {
    const stages = await loadStageList(tenantId, getCompanyId(req));
    res.json(stages);
  } catch (err) {
    console.error("GET /leads/stages error:", err);
    res.json(["new", "qualified", "proposal", "won", "lost"]);
  }
});

/* ---------------- GET /api/leads/check-mobile ---------------- */
router.get("/check-mobile", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ exists: false, error: "No tenant" });

  const raw = String(req.query.phone ?? req.query.mobile ?? "").trim();
  if (!raw) return res.json({ exists: false, reason: "empty" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const normRes = await client.query("SELECT public.phone_to_norm($1) AS pn", [raw]);
    const pn = normRes.rows?.[0]?.pn || null;

    if (!pn) return res.json({ exists: false, reason: "invalid" });
    if (pn.length < 6) return res.json({ exists: false, reason: "too_short", phone_norm: pn });

    const { rows } = await client.query(
      `SELECT id, name FROM public.leads
       WHERE tenant_id = ensure_tenant_scope() AND phone_norm = $1
       LIMIT 1`,
      [pn]
    );

    return res.json({ exists: rows.length > 0, lead: rows[0] || null, phone_norm: pn });
  } catch (err) {
    console.error("GET /leads/check-mobile error:", err);
    return res.status(500).json({ exists: false, error: "server_error" });
  } finally {
    client.release();
  }
});

/* ------------ helpers for POST (multipart + CFV insert) ------------ */

// type guards
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(x = "") {
  return typeof x === "string" && UUID_RE.test(x);
}

// Parse cfv JSON or cfv[i][field_id] style multipart
function parseCfvItems(body = {}, files = []) {
  const collected = [];

  const pushItem = (raw = {}) => {
    if (!raw || !raw.field_id) return;
    const field_id = String(raw.field_id);
    const value_number =
      raw.value_number !== undefined && raw.value_number !== "" ? Number(raw.value_number) : null;
    const value_date = raw.value_date ? String(raw.value_date).slice(0, 10) : null;
    const value_text = raw.value_text !== undefined ? String(raw.value_text) : null;

    collected.push({
      field_id,
      value_text,
      value_number: Number.isFinite(value_number) ? value_number : null,
      value_date,
      file: raw.file || null,
    });
  };

  // 1) JSON form: body.cfv as Array or Object
  const asJson = body?.cfv;
  if (Array.isArray(asJson)) {
    for (const it of asJson) pushItem(it);
  } else if (asJson && typeof asJson === "object") {
    for (const it of Object.values(asJson)) pushItem(it);
  }

  if (collected.length > 0) return collected;

  // 2) Multipart: cfv[0][field_id], cfv[0][value_text], cfv[0][file]
  const byIdx = {};
  const re = /^cfv\[(\d+)\]\[(\w+)\]$/;
  for (const [k, v] of Object.entries(body)) {
    const m = re.exec(k);
    if (!m) continue;
    const idx = +m[1], key = m[2];
    (byIdx[idx] ||= {})[key] = v;
  }
  for (const f of files) {
    const m = re.exec(f.fieldname);
    if (!m) continue;
    const idx = +m[1], key = m[2];
    if (key === "file") (byIdx[idx] ||= {}).file = f; // keep multer file object
  }
  for (const v of Object.values(byIdx)) pushItem(v);

  return collected;
}

// Map incoming body (JSON or multipart) to canonical fields
function normalizeLeadBody(req) {
  const b = req.body || {};
  const pick = (...keys) => keys.map(k => b[k]).find(v => v !== undefined && v !== null);
  const follow = pick("followup_at", "follow_up_date", "follow");
  return {
    name: String(pick("name", "title", "lead_name") || "").trim(),
    email: pick("email") ? String(b.email).trim() : null,
    phone: pick("phone", "mobile") ? String(pick("phone", "mobile")).trim() : null,
    website: pick("website") ? String(b.website).trim() : null,
    source: pick("source") ? String(b.source).trim() : null,
    status: pick("status") ? String(b.status).trim() : "new",
    stage:  pick("stage")  ? String(b.stage).trim()  : null,
    followup_at: follow ? new Date(String(follow).slice(0,10)) : null,
  };
}

/**
 * Fetches meta for provided field_ids and returns a map.
 * Skips invalid UUIDs to avoid ANY(uuid[]) casting issues.
 */
async function loadFieldMetaMap(client, fieldIds) {
  const valid = [...new Set(fieldIds.map(String))].filter(looksLikeUuid);
  if (!valid.length) return new Map();

  const { rows } = await client.query(
    `SELECT id, form_version_id, record_type, data_type
       FROM public.custom_fields
      WHERE tenant_id = ensure_tenant_scope()
        AND id = ANY($1)`,
    [valid]
  );
  return new Map(rows.map(r => [String(r.id), r]));
}

/**
 * Deletes existing CFVs for the given (record_type, record_id) limited to the provided field_ids,
 * then inserts the new set. This “merge” behavior avoids ON CONFLICT requirements and keeps rows clean.
 */
async function upsertCustomFieldValues(client, tenantId, recordType, recordId, items) {
  if (!items?.length) return;

  const fieldIds = [...new Set(items.map(i => i.field_id))].filter(looksLikeUuid);
  if (!fieldIds.length) {
    console.warn("[CFV] No valid field_ids after validation. Skipping CFV upsert.");
    return;
  }

  const metaMap = await loadFieldMetaMap(client, fieldIds);

  // Remove any existing values for these fields on this record (scoped to tenant & record)
  await client.query(
    `DELETE FROM public.custom_field_values
      WHERE tenant_id = ensure_tenant_scope()
        AND record_type = $1
        AND record_id = $2
        AND field_id = ANY($3)`,
    [recordType, recordId, fieldIds]
  );

  // Insert fresh rows
  for (const it of items) {
    const fid = String(it.field_id);
    const meta = metaMap.get(fid);
    if (!meta) {
      console.warn(`[CFV] Unknown custom_field id=${fid}; skipped.`);
      continue;
    }
    if (!meta.form_version_id) {
      console.warn(`[CFV] Field id=${fid} has no form_version_id; skipped.`);
      continue;
    }

    // Optionally coerce by data_type if your table uses it (text/number/date/json)
    let value_text = it.value_text ?? null;
    let value_number = it.value_number ?? null;
    let value_date = it.value_date ?? null;

    if (meta.data_type === "number") {
      value_number = Number.isFinite(Number(value_number)) ? Number(value_number) : null;
      value_text = null;
      value_date = null;
    } else if (meta.data_type === "date") {
      value_date = value_date ? String(value_date).slice(0, 10) : null;
      value_text = null;
      value_number = null;
    } else if (meta.data_type === "text" || !meta.data_type) {
      // default: text
      value_text = value_text != null ? String(value_text) : null;
      value_number = null;
      // keep date null
    }

    // TODO: if you have a files table, persist it.file.buffer and set file_id.
    const file_id = null;

    await client.query(
      `INSERT INTO public.custom_field_values
         (tenant_id, form_version_id, field_id, record_type, record_id,
          value_text, value_number, value_date, value_json, file_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tenantId,
        meta.form_version_id,
        fid,
        meta.record_type || recordType,
        recordId,
        value_text,
        value_number,
        value_date,
        null, // value_json (unused here)
        file_id,
      ]
    );
  }
}

/* ---------------- POST /api/leads (create) ---------------- */
// Accept both JSON and multipart; multipart carries cfv[...] entries (and optional files).
router.post("/", upload.any(), async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const lead = normalizeLeadBody(req);
  const name = lead.name;
  if (!name) return res.status(400).json({ error: "name is required" });

  const phone = lead.phone ?? null;
  const email = lead.email ?? null;
  const source = lead.source ?? null;
  const status = lead.status ?? "new";
  const stage  = lead.stage  ?? null;
  const followup_at = lead.followup_at || null;
  const cfvItems = parseCfvItems(req.body, req.files || []);

  const sql = `
    INSERT INTO public.leads
      (tenant_id, company_id, name, email, phone, website, source, status, stage, followup_at, custom)
    VALUES
      ($1,        $2,         $3,   $4,    $5,    $6,      $7,     $8,     $9,    $10,         $11)
    RETURNING id, tenant_id, company_id, name, email, phone, website, source, status, stage, followup_at, created_at;
  `;
  const params = [tenantId, companyId, name, email, phone, lead.website ?? null, source, status, stage, followup_at, {}];

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    await client.query("BEGIN");

    const { rows } = await client.query(sql, params);
    const created = rows[0];

    // Upsert CFV rows (record_type 'lead') for the sent field_ids
    await upsertCustomFieldValues(client, tenantId, "lead", created.id, cfvItems);

    await client.query("COMMIT");
    return res.status(201).json(created);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("POST /leads error:", err);
    if (err.code === "23514") {
      return res.status(400).json({ error: "Invalid phone number (too short after normalization)" });
    }
    if (err.code === "23505") {
      return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
    }
    return res.status(500).json({ error: "Failed to create lead" });
  } finally {
    client.release();
  }
});

/* ---------------- GET /api/leads/:id (fetch one) ---------------- */
router.get("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const params = [id];
    let extra = "";
    if (companyId) {
      params.push(companyId);
      extra = ` AND company_id::text = $${params.length}`;
    }

    const sql = `
      SELECT
        id,
        tenant_id,
        company_id,
        owner_id,
        name,
        company AS company_name,
        email,
        phone,
        website,
        source,
        status,
        stage,
        owner   AS owner_name,
        score,
        priority,
        tags_text,
        followup_at,
        created_at,
        updated_at,
        ai_summary,
        ai_next,
        ai_score,
        ai_next_action
      FROM public.leads
      WHERE id = $1
        AND tenant_id = ensure_tenant_scope()
        ${extra}
      LIMIT 1;
    `;

    const r = await client.query(sql, params);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next)
      ? row.ai_next
      : (typeof row.ai_next === "string" && row.ai_next.startsWith("["))
        ? JSON.parse(row.ai_next)
        : row.ai_next || [];

    return res.json(row);
  } catch (err) {
    console.error("GET /leads/:id error:", err);
    return res.status(500).json({ error: "Failed to load lead" });
  } finally {
    client.release();
  }
});

/* ---------------- PATCH /api/leads/:id (MASTER EDITS) ---------------- */
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  const patch = req.body || {};

  const allow = {
    // master fields
    name: "name",
    email: "email",
    phone: "phone",
    source: "source",
    followup_at: "followup_at",
    company_name: "company", // UI -> DB
    owner_name: "owner",     // UI -> DB
    website: "website",
    priority: "priority",
    tags_text: "tags_text",
    // existing
    status: "status",
    stage: "stage",
    owner_id: "owner_id",
    score: "score",
    ai_summary: "ai_summary",
    ai_next: "ai_next",
    ai_score: "ai_score",
  };

  const fields = [];
  const vals = [];
  let i = 0;

  for (const [uiKey, col] of Object.entries(allow)) {
    if (patch[uiKey] === undefined) continue;

    let v = patch[uiKey];

    if (col === "followup_at") {
      v = v ? new Date(v) : null; // accept ISO or yyyy-mm-dd
    } else if (col === "ai_next" && Array.isArray(v)) {
      v = JSON.stringify(v); // assign to json/text column
    } else if (col === "priority") {
      v = v === "" || v === null ? null : Number(v);
    }

    fields.push(`${col} = $${++i}`);
    vals.push(v);
  }

  if (!fields.length) return res.status(400).json({ error: "No updatable fields" });

  const whereVals = [id, tenantId];
  let whereSQL = `WHERE id = $${++i} AND tenant_id = $${++i}`;
  if (companyId) { whereVals.push(companyId); whereSQL += ` AND company_id::text = $${++i}`; }

  const sql = `
    UPDATE public.leads
       SET ${fields.join(", ")}, updated_at = NOW()
     ${whereSQL}
     RETURNING id,
               name,
               email,
               phone,
               website,
               source,
               followup_at,
               company AS company_name,
               owner   AS owner_name,
               priority,
               tags_text,
               status,
               stage,
               owner_id,
               score,
               ai_summary,
               ai_next,
               ai_score,
               updated_at;
  `;

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const r = await client.query(sql, [...vals, ...whereVals]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next) ? row.ai_next : JSON.parse(row.ai_next || "[]");
    res.json(row);
  } catch (err) {
    console.error("PATCH /leads/:id error:", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
    }
    res.status(500).json({ error: "Failed to update lead" });
  } finally {
    client.release();
  }
});

export default router;
