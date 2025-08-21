// src/routes/leads.routes.js
// Endpoints:
//   GET    /api/leads/ping
//   GET    /api/leads                 list (filters + paging)
//   GET    /api/leads/pipelines       distinct stages (array)
//   GET    /api/leads/stages          alias of pipelines
//   GET    /api/leads/check-mobile    (?phone= or ?mobile=)
//   POST   /api/leads                 create lead (multipart or JSON; inserts CFV rows)
//   POST   /api/leads/:id/cfv         upsert CFVs for existing lead (by field_id or code)
//   GET    /api/leads/:id             fetch one lead (tenant/company scoped)
//   PATCH  /api/leads/:id             update (MASTER FIELDS enabled)
//   GET    /api/leads/debug/custom-fields   list custom_fields for tenant

import express from "express";
import multer from "multer";
import { pool } from "../db/pool.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

const CFV_SOFTFAIL = process.env.CFV_SOFTFAIL === "1"; // if 1: CFV errors don't block lead create
const DEV_ERRORS   = process.env.DEV_ERRORS === "1";

/* ---------------- helpers ---------------- */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (x) => typeof x === "string" && UUID_RE.test(x);

function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}
function getSafeCompanyId(req) {
  const raw =
    req.session?.companyId ||
    req.session?.company_id ||
    req.get("x-company-id") ||
    req.query.company_id ||
    null;
  return isUuid(String(raw || "")) ? String(raw) : null; // ignore bad company ids (no 400)
}
async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists on this connection (for ensure_tenant_scope() + RLS)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* ---------------- diagnostics & error surfacing ---------------- */
if (process.env.NODE_ENV !== "production") {
  router.use((req, _res, next) => {
    console.log("[/api/leads] hit", {
      method: req.method,
      url: req.originalUrl,
      tenant: getTenantId(req),
      company: getSafeCompanyId(req),
      hasFiles: !!(req.files?.length),
    });
    next();
  });
}
// Add x-error on 4xx/5xx so the browser Network tab shows the exact reason
router.use((req, res, next) => {
  const _json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) {
      const reason = body?.error ? String(body.error) : "";
      if (reason) res.set("x-error", reason);
      console.error("[/api/leads ERROR]", {
        status: res.statusCode,
        url: req.originalUrl,
        method: req.method,
        error: reason,
      });
    }
    return _json(body);
  };
  next();
});

/* -------- schema introspection (cached) -------- */
let leadsSchemaCache = null;
let leadsSchemaFetchedAt = 0;
const SCHEMA_TTL_MS = 5 * 60 * 1000;

async function getLeadsSchema(client) {
  const now = Date.now();
  if (leadsSchemaCache && now - leadsSchemaFetchedAt < SCHEMA_TTL_MS) return leadsSchemaCache;

  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='leads'`
  );
  const set = new Set(rows.map(r => r.column_name));

  const has = (c) => set.has(c);
  const schema = {
    has_company: has("company"),
    has_company_name: has("company_name"),
    has_owner: has("owner"),
    has_owner_name: has("owner_name"),
    has_custom: has("custom"),
    has_website: has("website"),
    has_source: has("source"),
    has_status: has("status"),
    has_stage: has("stage"),
    has_followup_at: has("followup_at"),
    has_priority: has("priority"),
    has_tags_text: has("tags_text"),
    has_score: has("score"),
    has_ai_summary: has("ai_summary"),
    has_ai_next: has("ai_next"),
    has_ai_score: has("ai_score"),
    has_ai_next_action: has("ai_next_action"),
    has_email: has("email"),
    has_phone: has("phone"),
    has_updated_at: has("updated_at"),
    has_created_at: has("created_at"),
    has_id: has("id"),
    has_tenant_id: has("tenant_id"),
    has_company_id: has("company_id"),
    has_owner_id: has("owner_id"),
    has_name: has("name"),
  };

  leadsSchemaCache = schema;
  leadsSchemaFetchedAt = now;
  return schema;
}

/* -------- projection builders (avoid undefined_column) -------- */
function buildProjection(schema) {
  const sel = [];
  sel.push("id", "tenant_id", "company_id", "owner_id", "name");

  if (schema.has_company && schema.has_company_name) {
    sel.push("COALESCE(company, company_name) AS company_name");
  } else if (schema.has_company) {
    sel.push("company AS company_name");
  } else if (schema.has_company_name) {
    sel.push("company_name");
  } else {
    sel.push("NULL::text AS company_name");
  }

  if (schema.has_email) sel.push("email"); else sel.push("NULL::text AS email");
  if (schema.has_phone) sel.push("phone"); else sel.push("NULL::text AS phone");
  if (schema.has_website) sel.push("website"); else sel.push("NULL::text AS website");
  if (schema.has_source) sel.push("source"); else sel.push("NULL::text AS source");
  if (schema.has_status) sel.push("status"); else sel.push("NULL::text AS status");
  if (schema.has_stage) sel.push("stage"); else sel.push("NULL::text AS stage");

  if (schema.has_owner && schema.has_owner_name) {
    sel.push("COALESCE(owner, owner_name) AS owner_name");
  } else if (schema.has_owner) {
    sel.push("owner AS owner_name");
  } else if (schema.has_owner_name) {
    sel.push("owner_name");
  } else {
    sel.push("NULL::text AS owner_name");
  }

  if (schema.has_score) sel.push("score"); else sel.push("NULL::int AS score");
  if (schema.has_priority) sel.push("priority"); else sel.push("NULL::int AS priority");
  if (schema.has_tags_text) sel.push("tags_text"); else sel.push("NULL::text AS tags_text");
  if (schema.has_followup_at) sel.push("followup_at"); else sel.push("NULL::timestamptz AS followup_at");
  if (schema.has_created_at) sel.push("created_at"); else sel.push("NOW() AS created_at");
  if (schema.has_updated_at) sel.push("updated_at"); else sel.push("NOW() AS updated_at");

  if (schema.has_ai_summary) sel.push("ai_summary"); else sel.push("NULL::text AS ai_summary");
  if (schema.has_ai_next) sel.push("ai_next"); else sel.push("NULL::text AS ai_next");
  if (schema.has_ai_score) sel.push("ai_score"); else sel.push("NULL::int AS ai_score");
  if (schema.has_ai_next_action) sel.push("ai_next_action"); else sel.push("NULL::text AS ai_next_action");

  return sel.join(",\n      ");
}

/* ---------------- probe ---------------- */
router.get("/ping", (_req, res) => res.json({ ok: true, CFV_SOFTFAIL, DEV_ERRORS }));

/* ---------------- GET /api/leads (list) ---------------- */
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getSafeCompanyId(req); // ignore bad values

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? req.query.size, 10) || 25));
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  const stage = (req.query.stage || "").trim();
  const owner_id = (req.query.owner_id || "").trim();

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);

    const params = [tenantId];
    let where = `WHERE tenant_id = $1`;
    let i = params.length;

    if (companyId) { params.push(companyId); where += ` AND company_id::text = $${++i}`; }

    if (q) {
      const like = `%${q}%`;
      const searchCols = ["name"];
      if (schema.has_company) searchCols.push("company");
      else if (schema.has_company_name) searchCols.push("company_name");
      if (schema.has_email) searchCols.push("email");
      if (schema.has_phone) searchCols.push("phone");

      const orParts = [];
      for (const col of searchCols) {
        params.push(like);
        orParts.push(`${col} ILIKE $${++i}`);
      }
      if (orParts.length) where += ` AND (${orParts.join(" OR ")})`;
    }

    if (status)    { params.push(status);    where += ` AND status = $${++i}`; }
    if (stage)     { params.push(stage);     where += ` AND stage  = $${++i}`; }
    if (owner_id)  { params.push(owner_id);  where += ` AND owner_id::text = $${++i}`; }

    const offset = (page - 1) * size;

    const projection = buildProjection(schema);

    const listSQL = `
      SELECT
        ${projection}
      FROM public.leads
      ${where}
      ORDER BY ${schema.has_updated_at ? "updated_at" : "created_at"} DESC
      LIMIT ${size} OFFSET ${offset};
    `;
    const countSQL = `SELECT COUNT(*)::int AS total FROM public.leads ${where};`;

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
    console.error("GET /leads error:", {
      message: err?.message, code: err?.code, detail: err?.detail, column: err?.column, position: err?.position,
    });
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
    const stages = await loadStageList(tenantId, getSafeCompanyId(req));
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
    const stages = await loadStageList(tenantId, getSafeCompanyId(req));
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

/* ------------ CFV helpers ------------ */

// Parse cfv JSON or cfv[i][field_id]/[code] style multipart
function parseCfvItems(body = {}, files = []) {
  const collected = [];

  const pushItem = (raw = {}) => {
    if (!raw) return;
    const field_id = raw.field_id != null ? String(raw.field_id) : null;
    const code     = raw.code     != null ? String(raw.code)     : null;
    if (!field_id && !code) return;

    const value_number =
      raw.value_number !== undefined && raw.value_number !== "" ? Number(raw.value_number) : null;
    const value_date = raw.value_date ? String(raw.value_date).slice(0, 10) : null;
    const value_text = raw.value_text !== undefined ? String(raw.value_text) : null;

    let value_json = null;
    if (raw.value_json !== undefined && raw.value_json !== null && raw.value_json !== "") {
      try { value_json = typeof raw.value_json === "string" ? JSON.parse(raw.value_json) : raw.value_json; }
      catch { value_json = String(raw.value_json); }
    }

    collected.push({
      field_id: isUuid(field_id) ? field_id : null,
      code,
      value_text,
      value_number: Number.isFinite(value_number) ? value_number : null,
      value_date,
      value_json,
      file: raw.file || null,
    });
  };

  // 1) JSON body: cfv as array/object or stringified JSON
  let j = body?.cfv;
  if (Array.isArray(j)) {
    j.forEach(pushItem);
  } else if (j && typeof j === "object") {
    for (const [k, v] of Object.entries(j)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        pushItem({ ...v, field_id: v.field_id ?? (isUuid(k) ? k : undefined), code: v.code ?? (!isUuid(k) ? k : undefined) });
      } else {
        pushItem({ field_id: isUuid(k) ? k : undefined, code: !isUuid(k) ? k : undefined, value_text: v });
      }
    }
  } else if (typeof j === "string" && j.trim()) {
    try {
      const parsed = JSON.parse(j);
      if (Array.isArray(parsed)) parsed.forEach(pushItem);
      else if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object" && !Array.isArray(v)) {
            pushItem({ ...v, field_id: v.field_id ?? (isUuid(k) ? k : undefined), code: v.code ?? (!isUuid(k) ? k : undefined) });
          } else {
            pushItem({ field_id: isUuid(k) ? k : undefined, code: !isUuid(k) ? k : undefined, value_text: v });
          }
        }
      }
    } catch { /* fall through */ }
  }

  if (collected.length) return collected;

  // 2) Multipart keys: cfv[i][...]
  const byIdx = {};
  const re = /^cfv\[(\d+)\]\[(\w+)\]$/;
  for (const [k, v] of Object.entries(body)) {
    const m = re.exec(k); if (!m) continue;
    const idx = +m[1], key = m[2];
    (byIdx[idx] ||= {})[key] = v;
  }
  for (const f of files) {
    const m = re.exec(f.fieldname); if (!m) continue;
    const idx = +m[1], key = m[2];
    if (key === "file") (byIdx[idx] ||= {}).file = f;
  }
  Object.values(byIdx).forEach(pushItem);

  return collected;
}

// Resolve meta by ids OR codes (scoped to tenant)
async function loadFieldsByIdsOrCodes(client, ids = [], codes = []) {
  const hasIds = ids?.length > 0;
  const hasCodes = codes?.length > 0;
  if (!hasIds && !hasCodes) return [];

  const conds = [`tenant_id = ensure_tenant_scope()`];
  const params = [];
  let i = 0;

  if (hasIds)   { params.push(ids); conds.push(`id = ANY($${++i}::uuid[])`); }
  if (hasCodes) { params.push(codes.map(c => c.toLowerCase())); conds.push(`LOWER(code) = ANY($${++i}::text[])`); }

  const sql = `
    SELECT id, code, form_version_id, field_type
      FROM public.custom_fields
     WHERE ${conds.join(" AND ")}
  `;
  const { rows } = await client.query(sql, params);
  return rows.map(r => ({
    id: String(r.id),
    code: (r.code || "").toLowerCase(),
    form_version_id: r.form_version_id,
    field_type: (r.field_type || "").toLowerCase().trim(),
  }));
}

/**
 * Deletes existing CFVs for the given (record_type, record_id) limited to the provided field_ids,
 * then inserts the new set. Supports resolving by field_id OR code.
 */
async function upsertCustomFieldValues(client, tenantId, recordType, recordId, items) {
  if (!items?.length) return { deleted: 0, inserted: 0, reason: "empty_items" };

  const rawIds = [...new Set(items.map(i => (i.field_id ?? "").toString().trim()))].filter(isUuid);
  const rawCodes = [...new Set(items.map(i => (i.code ?? "").toString().trim().toLowerCase()))].filter(Boolean);

  const metas = await loadFieldsByIdsOrCodes(client, rawIds, rawCodes);
  const metaById = new Map(metas.map(m => [m.id, m]));
  const metaByCode = new Map(metas.map(m => [m.code, m]));

  const resolved = items.map(it => {
    const fid = isUuid(String(it.field_id || "")) ? String(it.field_id) : null;
    const code = it.code ? String(it.code).toLowerCase() : null;
    const meta = fid ? metaById.get(fid) : (code ? metaByCode.get(code) : null);
    return { it, meta };
  });

  const good = resolved.filter(r => r.meta);
  if (!good.length) {
    const e = new Error("No matching custom_fields for provided field_id/code");
    e.code = "CFV_NO_MATCH"; e.status = 400; throw e;
  }

  const missingFv = good.filter(r => !r.meta.form_version_id);
  if (missingFv.length) {
    const e = new Error("Some custom_fields missing form_version_id");
    e.code = "CFV_NO_FORM_VERSION"; e.status = 400; throw e;
  }

  const fieldIds = [...new Set(good.map(r => r.meta.id))];
  const delRes = await client.query(
    `DELETE FROM public.custom_field_values
      WHERE tenant_id = ensure_tenant_scope()
        AND record_type = $1
        AND record_id = $2
        AND field_id = ANY($3::uuid[])`,
    [recordType, recordId, fieldIds]
  );

  let inserted = 0;
  for (const { it, meta } of good) {
    let vText  = it.value_text ?? null;
    let vNum   = it.value_number ?? null;
    let vDate  = it.value_date ?? null;
    let vJson  = it.value_json ?? null;

    switch (meta.field_type) {
      case "number":
      case "int":
      case "integer":
      case "float":
      case "decimal":
      case "currency":
        vNum = Number.isFinite(Number(vNum)) ? Number(vNum) : null;
        vText = null; vDate = null; vJson = null;
        break;
      case "date":
      case "dob":
      case "birthday":
        vDate = vDate ? String(vDate).slice(0, 10) : null;
        vText = null; vNum = null; vJson = null;
        break;
      case "json":
      case "object":
      case "array":
        if (vJson == null && vText != null) {
          try { vJson = JSON.parse(vText); } catch { vJson = vText; }
          vText = null;
        }
        vNum = null; vDate = null;
        break;
      case "multiselect":
      case "multi_select":
      case "checkboxes":
      case "tags":
        if (!Array.isArray(vJson)) {
          if (Array.isArray(vText)) vJson = vText;
          else if (typeof vText === "string") {
            vJson = vText.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          } else {
            vJson = vJson ?? [];
          }
        }
        vText = null; vNum = null; vDate = null;
        break;
      default: // text/select/radio/email/phone -> value_text
        if (vText != null) vText = String(vText);
        vNum = null; vDate = null; // keep vJson only if explicitly provided
        break;
    }

    await client.query(
      `INSERT INTO public.custom_field_values
         (tenant_id, form_version_id, field_id, record_type, record_id,
          value_text, value_number, value_date, value_json, file_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tenantId, meta.form_version_id, meta.id, recordType, recordId, vText, vNum, vDate, vJson, null]
    );
    inserted++;
  }

  return { deleted: delRes.rowCount || 0, inserted };
}

/* ---------------- POST /api/leads (create) ---------------- */
router.post("/", upload.any(), async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getSafeCompanyId(req); // ignore bad company-id

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

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);

    await client.query("BEGIN");

    const cols = ["tenant_id", "company_id", "name"];
    const vals = [tenantId, companyId, name];
    const ph = ["$1", "$2", "$3"];
    let i = 3;

    if (schema.has_email)      { cols.push("email");      vals.push(email);       ph.push(`$${++i}`); }
    if (schema.has_phone)      { cols.push("phone");      vals.push(phone);       ph.push(`$${++i}`); }
    if (schema.has_website)    { cols.push("website");    vals.push(lead.website ?? null); ph.push(`$${++i}`); }
    if (schema.has_source)     { cols.push("source");     vals.push(source);      ph.push(`$${++i}`); }
    if (schema.has_status)     { cols.push("status");     vals.push(status);      ph.push(`$${++i}`); }
    if (schema.has_stage)      { cols.push("stage");      vals.push(stage);       ph.push(`$${++i}`); }
    if (schema.has_followup_at){ cols.push("followup_at");vals.push(followup_at); ph.push(`$${++i}`); }
    if (schema.has_custom)     { cols.push("custom");     vals.push(JSON.stringify({})); ph.push(`$${++i}`); }

    const projection = buildProjection(schema);

    const insertSQL = `
      INSERT INTO public.leads (${cols.join(", ")})
      VALUES (${ph.join(", ")})
      RETURNING ${projection};
    `;
    const { rows } = await client.query(insertSQL, vals);
    const created = rows[0];

    // Upsert CFV rows (record_type 'lead') for the sent field_ids/codes
    try {
      if (cfvItems.length) {
        await upsertCustomFieldValues(client, tenantId, "lead", created.id, cfvItems);
      }
    } catch (e) {
      if (CFV_SOFTFAIL) {
        console.warn("[CFV] soft-fail on create:", e?.code || e?.message);
      } else {
        throw e;
      }
    }

    await client.query("COMMIT");

    created.ai_next = Array.isArray(created.ai_next)
      ? created.ai_next
      : (typeof created.ai_next === "string" && created.ai_next.startsWith("["))
        ? JSON.parse(created.ai_next)
        : created.ai_next || [];

    return res.status(201).json(created);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("POST /leads error:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      table: err?.table, column: err?.column, constraint: err?.constraint, position: err?.position,
      stack: DEV_ERRORS ? err?.stack : undefined,
    });
    switch (err?.code) {
      case "CFV_NO_MATCH":        return res.status(400).json({ error: "No matching custom_fields for provided field_id/code" });
      case "CFV_NO_FORM_VERSION": return res.status(400).json({ error: "Some custom_fields missing form_version_id" });
      case "23514": return res.status(400).json({ error: "Invalid phone number (too short after normalization)" });
      case "23505": return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
      case "22P02": return res.status(400).json({ error: "Invalid UUID in x-company-id or cfv.field_id" });
      case "23503": return res.status(400).json({ error: "Invalid reference: company_id or custom_field_id not found for tenant" });
      case "23502": return res.status(400).json({ error: `Missing required column: ${err.column}` });
      case "42703": return res.status(500).json({ error: `Column not found in current schema (check logs for position)` });
      default:
        return res.status(500).json({ error: "Failed to create lead" });
    }
  } finally {
    client.release();
  }
});

/* ---------------- POST /api/leads/:id/cfv (attach CFVs to existing lead) ---------------- */
router.post("/:id/cfv", upload.any(), async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const { rowCount } = await client.query(
      `SELECT 1 FROM public.leads WHERE id = $1 AND tenant_id = ensure_tenant_scope() LIMIT 1`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: "Lead not found" });

    const cfvItems = parseCfvItems(req.body, req.files || []);
    if (!cfvItems.length) return res.status(400).json({ error: "No cfv items" });

    await client.query("BEGIN");
    const stats = await upsertCustomFieldValues(client, tenantId, "lead", id, cfvItems);
    await client.query("COMMIT");

    res.json({ ok: true, ...stats });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("POST /leads/:id/cfv error:", {
      message: err?.message, code: err?.code, detail: err?.detail,
    });
    switch (err?.code) {
      case "CFV_NO_MATCH":        return res.status(400).json({ error: "No matching custom_fields for provided field_id/code" });
      case "CFV_NO_FORM_VERSION": return res.status(400).json({ error: "Some custom_fields missing form_version_id" });
      case "22P02":               return res.status(400).json({ error: "Invalid UUID in cfv.field_id" });
      default:                    return res.status(500).json({ error: "Failed to upsert CFV" });
    }
  } finally {
    client.release();
  }
});

/* ---------------- GET /api/leads/:id (fetch one) ---------------- */
router.get("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getSafeCompanyId(req);

  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    const projection = buildProjection(schema);

    const params = [id];
    let extra = "";
    if (companyId) {
      params.push(companyId);
      extra = ` AND company_id::text = $${params.length}`;
    }

    const sql = `
      SELECT
        ${projection}
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
    console.error("GET /leads/:id error:", {
      message: err?.message, code: err?.code, detail: err?.detail, column: err?.column, position: err?.position,
    });
    return res.status(500).json({ error: "Failed to load lead" });
  } finally {
    client.release();
  }
});

/* ---------------- PATCH /api/leads/:id (MASTER EDITS) ---------------- */
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getSafeCompanyId(req);

  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const patch = req.body || {};

  const allow = {
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
    status: "status",
    stage: "stage",
    owner_id: "owner_id",
    score: "score",
    ai_summary: "ai_summary",
    ai_next: "ai_next",
    ai_score: "ai_score",
  };

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);

    const fields = [];
    const vals = [];
    let i = 0;

    for (const [uiKey, col] of Object.entries(allow)) {
      if (patch[uiKey] === undefined) continue;

      if (
        (col === "company"     && !(schema.has_company || schema.has_company_name)) ||
        (col === "owner"       && !(schema.has_owner || schema.has_owner_name)) ||
        (col === "website"     && !schema.has_website) ||
        (col === "priority"    && !schema.has_priority) ||
        (col === "tags_text"   && !schema.has_tags_text) ||
        (col === "status"      && !schema.has_status) ||
        (col === "stage"       && !schema.has_stage) ||
        (col === "owner_id"    && !schema.has_owner_id) ||
        (col === "score"       && !schema.has_score) ||
        (col === "ai_summary"  && !schema.has_ai_summary) ||
        (col === "ai_next"     && !schema.has_ai_next) ||
        (col === "ai_score"    && !schema.has_ai_score) ||
        (col === "email"       && !schema.has_email) ||
        (col === "phone"       && !schema.has_phone) ||
        (col === "followup_at" && !schema.has_followup_at) ||
        (col === "name"        && !schema.has_name) ||
        (col === "source"      && !schema.has_source)
      ) {
        continue;
      }

      let v = patch[uiKey];

      if (col === "followup_at") {
        v = v ? new Date(v) : null; // ISO or yyyy-mm-dd
      } else if (col === "ai_next" && Array.isArray(v)) {
        v = JSON.stringify(v); // assign to json/text column
      } else if (col === "priority") {
        v = v === "" || v === null ? null : Number(v);
      }

      if (uiKey === "company_name" && !schema.has_company && schema.has_company_name) {
        fields.push(`company_name = $${++i}`);
      } else if (uiKey === "owner_name" && !schema.has_owner && schema.has_owner_name) {
        fields.push(`owner_name = $${++i}`);
      } else {
        fields.push(`${col} = $${++i}`);
      }
      vals.push(v);
    }

    if (!fields.length) return res.status(400).json({ error: "No updatable fields" });

    const whereVals = [id, tenantId];
    let whereSQL = `WHERE id = $${++i} AND tenant_id = $${++i}`;
    if (companyId) { whereVals.push(companyId); whereSQL += ` AND company_id::text = $${++i}`; }

    const projection = buildProjection(schema);

    const sql = `
      UPDATE public.leads
         SET ${fields.join(", ")}, updated_at = NOW()
       ${whereSQL}
       RETURNING ${projection};
    `;

    const r = await client.query(sql, [...vals, ...whereVals]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next) ? row.ai_next : JSON.parse(row.ai_next || "[]");
    res.json(row);
  } catch (err) {
    console.error("PATCH /leads/:id error:", {
      message: err?.message, code: err?.code, detail: err?.detail, column: err?.column, position: err?.position,
    });
    switch (err?.code) {
      case "23505":
        return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
      case "22P02":
        return res.status(400).json({ error: "Invalid UUID in request" });
      case "42703":
        return res.status(500).json({ error: `Column not found in current schema (check logs for position)` });
      default:
        return res.status(500).json({ error: "Failed to update lead" });
    }
  } finally {
    client.release();
  }
});

/* ---------------- DEBUG: list custom_fields for tenant ---------------- */
router.get("/debug/custom-fields", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });
  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const { rows } = await client.query(
      `SELECT id, code, field_type, form_version_id, created_at
         FROM public.custom_fields
        WHERE tenant_id = ensure_tenant_scope()
        ORDER BY code NULLS LAST, created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /leads/debug/custom-fields error", e);
    res.status(500).json({ error: "Failed to list custom_fields" });
  } finally {
    client.release();
  }
});

export default router;

/* ------------ body mapper (keep at end) ------------ */
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
