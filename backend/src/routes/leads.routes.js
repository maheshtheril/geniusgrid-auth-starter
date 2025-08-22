// src/routes/leads.routes.js
import express from "express";
import multer from "multer";
import { pool } from "../db/pool.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

/* ---------------- config: temporary hard-coded company + record_type ---------------- */
const DEFAULT_COMPANY_ID = "af3b367a-d61c-4748-9536-3fe94fe2d247";
const RECORD_TYPE_FOR_LEADS = process.env.CFV_RECORD_TYPE_LEAD || "lead";

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
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

// map request body (JSON or multipart) to canonical lead fields
function normalizeLeadBody(req) {
  const b = req.body || {};
  const pick = (...keys) =>
    keys.map((k) => b[k]).find((v) => v !== undefined && v !== null);
  const follow = pick("followup_at", "follow_up_date", "follow");
  return {
    name: String(pick("name", "title", "lead_name") || "").trim(),
    email: pick("email") ? String(b.email).trim() : null,
    phone: pick("phone", "mobile") ? String(pick("phone", "mobile")).trim() : null,
    website: pick("website") ? String(b.website).trim() : null,
    source: pick("source") ? String(b.source).trim() : null,
    status: pick("status") ? String(b.status).trim() : "new",
    stage: pick("stage") ? String(b.stage).trim() : null,
    followup_at: follow ? new Date(String(follow).slice(0, 10)) : null,
  };
}

if (process.env.NODE_ENV !== "production") {
  router.use((req, _res, next) => {
    console.log("[/api/leads] hit", {
      method: req.method,
      url: req.originalUrl,
      tenant: getTenantId(req),
      company: getCompanyId(req),
      hasFiles: !!(req.files?.length),
    });
    next();
  });
}

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
  const set = new Set(rows.map((r) => r.column_name));
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

function buildProjection(schema) {
  const sel = [];
  sel.push("id", "tenant_id", "company_id", "owner_id", "name");

  if (schema.has_company && schema.has_company_name) sel.push("COALESCE(company, company_name) AS company_name");
  else if (schema.has_company) sel.push("company AS company_name");
  else if (schema.has_company_name) sel.push("company_name");
  else sel.push("NULL::text AS company_name");

  if (schema.has_email) sel.push("email"); else sel.push("NULL::text AS email");
  if (schema.has_phone) sel.push("phone"); else sel.push("NULL::text AS phone");
  if (schema.has_website) sel.push("website"); else sel.push("NULL::text AS website");
  if (schema.has_source) sel.push("source"); else sel.push("NULL::text AS source");
  if (schema.has_status) sel.push("status"); else sel.push("NULL::text AS status");
  if (schema.has_stage) sel.push("stage"); else sel.push("NULL::text AS stage");

  if (schema.has_owner && schema.has_owner_name) sel.push("COALESCE(owner, owner_name) AS owner_name");
  else if (schema.has_owner) sel.push("owner AS owner_name");
  else if (schema.has_owner_name) sel.push("owner_name");
  else sel.push("NULL::text AS owner_name");

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

/* ---------- PROBE (no DB) ---------- */
router.post("/__probe", upload.any(), (req, res) => {
  res.json({
    ok: true,
    auth: !!req.session?.userId,
    tenant: getTenantId(req),
    company: getCompanyId(req) || DEFAULT_COMPANY_ID,
    bodyKeys: Object.keys(req.body || {}),
    cfvRaw: Object.entries(req.body || {}).filter(([k]) => k.startsWith("cfv[")),
    files: (req.files || []).map((f) => ({
      fieldname: f.fieldname,
      size: f.size,
      mimetype: f.mimetype,
    })),
  });
});

/* ---------------- probe ---------------- */
router.get("/ping", (_req, res) => res.json({ ok: true }));

/* ---------------- list ---------------- */
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  if (companyId && !isUuid(companyId)) return res.status(400).json({ error: "Invalid x-company-id (must be UUID)" });

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
      const or = [];
      for (const col of searchCols) { params.push(like); or.push(`${col} ILIKE $${++i}`); }
      if (or.length) where += ` AND (${or.join(" OR ")})`;
    }

    if (status)   { params.push(status);   where += ` AND status = $${++i}`; }
    if (stage)    { params.push(stage);    where += ` AND stage  = $${++i}`; }
    if (owner_id) { params.push(owner_id); where += ` AND owner_id::text = $${++i}`; }

    const offset = (page - 1) * size;
    const projection = buildProjection(schema);

    const listSQL  = `SELECT ${projection} FROM public.leads ${where}
                      ORDER BY ${schema.has_updated_at ? "updated_at" : "created_at"} DESC
                      LIMIT ${size} OFFSET ${offset};`;
    const countSQL = `SELECT COUNT(*)::int AS total FROM public.leads ${where};`;

    const [list, count] = await Promise.all([client.query(listSQL, params), client.query(countSQL, params)]);
    const items = (list.rows || []).map((r) => ({
      ...r,
      ai_next:
        Array.isArray(r.ai_next)
          ? r.ai_next
          : (typeof r.ai_next === "string" && r.ai_next.startsWith("["))
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

/* ---------------- distinct stages ---------------- */
async function loadStageList(tenantId, companyId) {
  const params = [tenantId];
  let where = `WHERE tenant_id = $1 AND stage IS NOT NULL AND stage <> ''`;
  let j = params.length;
  if (companyId) { params.push(companyId); where += ` AND company_id::text = $${++j}`; }
  const { rows } = await pool.query(`SELECT DISTINCT stage FROM public.leads ${where} ORDER BY stage ASC`, params);
  const stages = rows.map((r) => r.stage).filter(Boolean);
  return stages.length ? stages : ["new", "qualified", "proposal", "won", "lost"];
}
router.get("/pipelines", async (req, res) => {
  const tenantId = getTenantId(req); if (!tenantId) return res.status(401).json({ error: "No tenant" });
  try { res.json(await loadStageList(tenantId, getCompanyId(req))); } catch { res.json(["new","qualified","proposal","won","lost"]); }
});
router.get("/stages", async (req, res) => {
  const tenantId = getTenantId(req); if (!tenantId) return res.status(401).json({ error: "No tenant" });
  try { res.json(await loadStageList(tenantId, getCompanyId(req))); } catch { res.json(["new","qualified","proposal","won","lost"]); }
});

/* ---------------- check-mobile ---------------- */
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

/* ---------------- CFV helpers ---------------- */
function parseCfvItems(body = {}, files = []) {
  const out = [];
  const isU = (s) => typeof s === "string" && UUID_RE.test(s);

  const pushItem = (raw = {}) => {
    if (!raw) return;
    const item = {
      field_id: raw.field_id != null ? String(raw.field_id) : null,
      code: raw.code != null ? String(raw.code) : null,
      value_text: raw.value_text !== undefined ? String(raw.value_text) : null,
      value_number: raw.value_number !== undefined && raw.value_number !== "" ? Number(raw.value_number) : null,
      value_date: raw.value_date ? String(raw.value_date).slice(0, 10) : null,
      value_json: null,
      file: raw.file || null,
    };
    if (raw.value_json !== undefined && raw.value_json !== null && raw.value_json !== "") {
      try { item.value_json = typeof raw.value_json === "string" ? JSON.parse(raw.value_json) : raw.value_json; }
      catch { item.value_json = String(raw.value_json); }
    }
    if (!item.field_id && !item.code) return;
    if (item.field_id && !isU(item.field_id)) item.field_id = null; // ignore invalid uuid
    out.push(item);
  };

  // JSON styles
  const j = body?.cfv;
  if (Array.isArray(j)) j.forEach(pushItem);
  else if (j && typeof j === "object") {
    for (const [k, v] of Object.entries(j)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        pushItem({
          ...v,
          field_id: v.field_id ?? (isU(k) ? k : undefined),
          code: v.code ?? (!isU(k) ? k : undefined),
        });
      } else {
        pushItem({ field_id: isU(k) ? k : undefined, code: !isU(k) ? k : undefined, value_text: v });
      }
    }
  } else if (typeof j === "string" && j.trim()) {
    try {
      const parsed = JSON.parse(j);
      if (Array.isArray(parsed)) parsed.forEach(pushItem);
      else if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object" && !Array.isArray(v))
            pushItem({
              ...v,
              field_id: v.field_id ?? (isU(k) ? k : undefined),
              code: v.code ?? (!isU(k) ? k : undefined),
            });
          else pushItem({ field_id: isU(k) ? k : undefined, code: !isU(k) ? k : undefined, value_text: v });
        }
      }
    } catch { /* fall through */ }
  }

  if (out.length) return out;

  // multipart cfv[i][...]
  const byIdx = {};
  const re = /^cfv\[(\d+)\]\[(\w+)\]$/;
  for (const [k, v] of Object.entries(body)) {
    const m = re.exec(k); if (!m) continue;
    const idx = +m[1], key = m[2]; (byIdx[idx] ||= {})[key] = v;
  }
  for (const f of files) {
    const m = re.exec(f.fieldname); if (!m) continue;
    const idx = +m[1], key = m[2]; if (key === "file") (byIdx[idx] ||= {}).file = f;
  }
  Object.values(byIdx).forEach(pushItem);
  return out;
}

async function loadFieldMetaMap(client, byFieldId, byCode) {
  const ids = [...new Set((byFieldId || []).filter(Boolean))].filter(isUuid);
  const codes = [...new Set((byCode || []).map((c) => String(c).trim()).filter(Boolean))];

  const map = new Map();

  if (ids.length) {
    const { rows } = await client.query(
      `SELECT id, code, form_version_id, field_type
       FROM public.custom_fields
       WHERE tenant_id = ensure_tenant_scope()
         AND id = ANY($1::uuid[])`,
      [ids]
    );
    for (const r of rows)
      map.set(String(r.id), {
        id: String(r.id),
        code: r.code || null,
        form_version_id: r.form_version_id,
        field_type: (r.field_type || "").toLowerCase().trim(),
      });
  }

  if (codes.length) {
    const { rows } = await client.query(
      `SELECT id, code, form_version_id, field_type
       FROM public.custom_fields
       WHERE tenant_id = ensure_tenant_scope()
         AND code = ANY($1::text[])`,
      [codes]
    );
    for (const r of rows) {
      const id = String(r.id);
      if (!map.has(id))
        map.set(id, {
          id,
          code: r.code || null,
          form_version_id: r.form_version_id,
          field_type: (r.field_type || "").toLowerCase().trim(),
        });
    }
  }

  return map;
}

async function upsertCustomFieldValues(client, tenantId, recordType, recordId, items) {
  if (!items?.length) return { count: 0, resolved: [], skipped: [] };

  const requestedIds = items.map((i) => i.field_id).filter(Boolean);
  const requestedCodes = items.map((i) => i.code).filter(Boolean);
  const metaMap = await loadFieldMetaMap(client, requestedIds, requestedCodes);

  const rowsToInsert = [];
  const resolved = [];
  const skipped = [];

  for (const it of items) {
    let meta = null;

    if (it.field_id && metaMap.has(String(it.field_id))) meta = metaMap.get(String(it.field_id));
    else if (it.code) {
      const found = [...metaMap.values()].find(
        (m) => (m.code || "").toLowerCase() === String(it.code).toLowerCase()
      );
      if (found) meta = found;
    }

    if (!meta) { skipped.push({ ...it, reason: "unknown_field" }); continue; }
    if (!meta.form_version_id) { skipped.push({ ...it, reason: "no_form_version" }); continue; }

    let vText = it.value_text ?? null;
    let vNum  = it.value_number ?? null;
    let vDate = it.value_date ?? null;
    let vJson = it.value_json ?? null;

    switch ((meta.field_type || "").toLowerCase()) {
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
          else if (typeof vText === "string")
            vJson = vText.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
          else vJson = vJson ?? [];
        }
        vText = null; vNum = null; vDate = null;
        break;

      default: // text/select/email/phone/etc.
        if (vText != null) vText = String(vText);
        vNum = null; vDate = null; // keep vJson only if explicitly provided
        break;
    }

    rowsToInsert.push({
      tenant_id: tenantId,
      form_version_id: meta.form_version_id,
      field_id: meta.id,
      record_type: recordType,
      record_id: recordId,
      value_text: vText,
      value_number: vNum,
      value_date: vDate,
      value_json: vJson,
      file_id: null,
    });
    resolved.push({ field_id: meta.id, code: meta.code, type: meta.field_type });
  }

  if (!rowsToInsert.length) return { count: 0, resolved, skipped };

  const fieldIds = [...new Set(rowsToInsert.map((r) => r.field_id))];
  await client.query(
    `DELETE FROM public.custom_field_values
      WHERE tenant_id = ensure_tenant_scope()
        AND record_type = $1
        AND record_id = $2
        AND field_id = ANY($3::uuid[])`,
    [recordType, recordId, fieldIds]
  );

  const insertSQL = `
    INSERT INTO public.custom_field_values
      (tenant_id, form_version_id, field_id, record_type, record_id, value_text, value_number, value_date, value_json, file_id)
    SELECT x.tenant_id, x.form_version_id, x.field_id, x.record_type, x.record_id, x.value_text, x.value_number, x.value_date, x.value_json, x.file_id
      FROM jsonb_to_recordset($1::jsonb) AS x(
        tenant_id uuid,
        form_version_id uuid,
        field_id uuid,
        record_type text,
        record_id uuid,
        value_text text,
        value_number numeric,
        value_date date,
        value_json jsonb,
        file_id uuid
      )`;
  const payload = JSON.stringify(rowsToInsert);
  const ins = await client.query(insertSQL, [payload]);
  return { count: ins.rowCount || rowsToInsert.length, resolved, skipped };
}

/* ---------------- POST create (JSON or multipart) ---------------- */
router.post("/", upload.any(), async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  let companyId = getCompanyId(req) || DEFAULT_COMPANY_ID;
  if (!isUuid(String(companyId || "")))
    return res.status(400).json({ error: "Invalid x-company-id (must be UUID)" });

  const lead = normalizeLeadBody(req);
  if (!lead.name) return res.status(400).json({ error: "name is required" });

  const cfvItems = parseCfvItems(req.body, req.files || []);
  const wantDebug = req.query.debug_cfv == "1" || req.get("x-debug-cfv") === "1";

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    await client.query("BEGIN");

    const cols = ["tenant_id", "company_id", "name"];
    const vals = [tenantId, companyId, lead.name];
    const ph = ["$1", "$2", "$3"];
    let i = 3;

    if (schema.has_email)      { cols.push("email");      vals.push(lead.email ?? null);       ph.push(`$${++i}`); }
    if (schema.has_phone)      { cols.push("phone");      vals.push(lead.phone ?? null);       ph.push(`$${++i}`); }
    if (schema.has_website)    { cols.push("website");    vals.push(lead.website ?? null);     ph.push(`$${++i}`); }
    if (schema.has_source)     { cols.push("source");     vals.push(lead.source ?? null);      ph.push(`$${++i}`); }
    if (schema.has_status)     { cols.push("status");     vals.push(lead.status ?? "new");     ph.push(`$${++i}`); }
    if (schema.has_stage)      { cols.push("stage");      vals.push(lead.stage ?? null);       ph.push(`$${++i}`); }
    if (schema.has_followup_at){ cols.push("followup_at");vals.push(lead.followup_at ?? null); ph.push(`$${++i}`); }
    if (schema.has_custom)     { cols.push("custom");     vals.push(JSON.stringify({}));       ph.push(`$${++i}`); }

    const projection = buildProjection(schema);
    const insertSQL = `INSERT INTO public.leads (${cols.join(", ")})
                       VALUES (${ph.join(", ")})
                       RETURNING ${projection};`;
    const { rows } = await client.query(insertSQL, vals);
    const created = rows[0];

    const cfvResult = await upsertCustomFieldValues(
      client,
      tenantId,
      RECORD_TYPE_FOR_LEADS,
      created.id,
      cfvItems
    );

    await client.query("COMMIT");

    created.ai_next = Array.isArray(created.ai_next)
      ? created.ai_next
      : (typeof created.ai_next === "string" && created.ai_next.startsWith("["))
      ? JSON.parse(created.ai_next)
      : created.ai_next || [];

    if (wantDebug) {
      return res.status(201).json({
        ...created,
        _cfv_inserted: cfvResult.count,
        _cfv_resolved: cfvResult.resolved,
        _cfv_skipped: cfvResult.skipped,
        _parsed_cfv: cfvItems,
      });
    }
    return res.status(201).json({ ...created, _cfv_inserted: cfvResult.count });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("POST /leads error:", err);
    switch (err?.code) {
      case "23514": return res.status(400).json({ error: "Invalid phone number (too short after normalization)" });
      case "23505": return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
      case "22P02": return res.status(400).json({ error: "Invalid UUID in x-company-id or cfv.field_id" });
      case "23503": return res.status(400).json({ error: "Invalid reference: company_id or custom_field_id not found for tenant" });
      case "23502": return res.status(400).json({ error: `Missing required column: ${err.column}` });
      case "42703": return res.status(500).json({ error: `Column not found in current schema (check logs for position)` });
      default:      return res.status(500).json({ error: "Failed to create lead" });
    }
  } finally {
    client.release();
  }
});

/* ---------------- get one ---------------- */
router.get("/:id", async (req, res) => {
  const tenantId = getTenantId(req); if (!tenantId) return res.status(401).json({ error: "No tenant" });
  const companyId = getCompanyId(req); if (companyId && !isUuid(companyId)) return res.status(400).json({ error: "Invalid x-company-id (must be UUID)" });
  const { id } = req.params; if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    const projection = buildProjection(schema);

    const params = [id, tenantId];
    let extra = "";
    if (companyId) { params.push(companyId); extra = ` AND company_id::text = $3`; }

    const sql = `
      SELECT ${projection}
      FROM public.leads
      WHERE id = $1 AND tenant_id = $2 ${extra}
      LIMIT 1;`;
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

/* ---------------- patch ---------------- */
router.patch("/:id", async (req, res) => {
  const tenantId = getTenantId(req); if (!tenantId) return res.status(401).json({ error: "No tenant" });
  const companyId = getCompanyId(req); if (companyId && !isUuid(companyId)) return res.status(400).json({ error: "Invalid x-company-id (must be UUID)" });

  const { id } = req.params; if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });
  const patch = req.body || {};

  const allow = {
    name: "name", email: "email", phone: "phone", source: "source",
    followup_at: "followup_at", company_name: "company", owner_name: "owner",
    website: "website", priority: "priority", tags_text: "tags_text",
    status: "status", stage: "stage", owner_id: "owner_id", score: "score",
    ai_summary: "ai_summary", ai_next: "ai_next", ai_score: "ai_score",
  };

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);

    const fields = [];
    const vals = [];
    let i = 0;

    const has = (col) =>
      (col === "company"     ? (schema.has_company || schema.has_company_name)
      : col === "owner"      ? (schema.has_owner   || schema.has_owner_name)
      : col === "website"    ?  schema.has_website
      : col === "priority"   ?  schema.has_priority
      : col === "tags_text"  ?  schema.has_tags_text
      : col === "status"     ?  schema.has_status
      : col === "stage"      ?  schema.has_stage
      : col === "owner_id"   ?  schema.has_owner_id
      : col === "score"      ?  schema.has_score
      : col === "ai_summary" ?  schema.has_ai_summary
      : col === "ai_next"    ?  schema.has_ai_next
      : col === "ai_score"   ?  schema.has_ai_score
      : col === "email"      ?  schema.has_email
      : col === "phone"      ?  schema.has_phone
      : col === "followup_at"?  schema.has_followup_at
      : col === "name"       ?  schema.has_name
      : col === "source"     ?  schema.has_source
      : false);

    for (const [uiKey, col] of Object.entries(allow)) {
      if (patch[uiKey] === undefined || !has(col)) continue;
      let v = patch[uiKey];
      if (col === "followup_at") v = v ? new Date(v) : null;
      else if (col === "ai_next" && Array.isArray(v)) v = JSON.stringify(v);
      else if (col === "priority") v = v === "" || v === null ? null : Number(v);

      if (uiKey === "company_name" && !schema.has_company && schema.has_company_name) fields.push(`company_name = $${++i}`);
      else if (uiKey === "owner_name" && !schema.has_owner && schema.has_owner_name) fields.push(`owner_name = $${++i}`);
      else fields.push(`${col} = $${++i}`);
      vals.push(v);
    }

    if (!fields.length) return res.status(400).json({ error: "No updatable fields" });

    const whereVals = [id, tenantId];
    let whereSQL = `WHERE id = $${++i} AND tenant_id = $${++i}`;
    if (companyId) { whereVals.push(companyId); whereSQL += ` AND company_id::text = $${++i}`; }

    const projection = buildProjection(schema);
    const sql = `UPDATE public.leads SET ${fields.join(", ")}, updated_at = NOW() ${whereSQL} RETURNING ${projection};`;
    const r = await client.query(sql, [...vals, ...whereVals]);
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });

    const row = r.rows[0];
    row.ai_next = Array.isArray(row.ai_next) ? row.ai_next : JSON.parse(row.ai_next || "[]");
    res.json(row);
  } catch (err) {
    console.error("PATCH /leads/:id error:", err);
    switch (err?.code) {
      case "23505": return res.status(409).json({ error: "Duplicate email or phone for this tenant" });
      case "22P02": return res.status(400).json({ error: "Invalid UUID in request" });
      case "42703": return res.status(500).json({ error: `Column not found in current schema (check logs for position)` });
      default:      return res.status(500).json({ error: "Failed to update lead" });
    }
  } finally {
    client.release();
  }
});

export default router;
