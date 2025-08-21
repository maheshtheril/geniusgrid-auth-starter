// src/routes/leads.routes.js
// PANIC MODE (DB-less): never 500s, 201 on create, simple in-memory store
// Swap back to your real router after your DB/migrations are fixed.

import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";

const router = express.Router();

// ensure parsing even if app.js forgot it
router.use(express.json({ limit: "2mb" }));
router.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

// ---- config / fallbacks ----
const DEV_TENANT  = process.env.DEV_TENANT  || "dev-tenant";
const DEV_COMPANY = process.env.DEV_COMPANY || "dev-company";
const MODE = "panic";

// ---- tiny utils ----
const nowISO = () => new Date().toISOString();
const log = (...a) => { if (process.env.NODE_ENV !== "production") console.log("[PANIC /api/leads]", ...a); };
const getTenantId = (req) =>
  req.get("x-tenant-id") || req.query.tenant_id || req.session?.tenantId || DEV_TENANT;
const getCompanyId = (req) =>
  req.get("x-company-id") || req.query.company_id || req.session?.companyId || DEV_COMPANY;

const phoneNorm = (raw) => {
  if (!raw) return null;
  const s = String(raw);
  if (s.startsWith("+")) return "+" + s.slice(1).replace(/[^0-9]/g, "");
  return s.replace(/[^0-9]/g, "");
};

// ---- in-memory store (per process) ----
const MEM = {
  leads: [], // array of lead objects
};

// default stage set to show something on empty data
const DEFAULT_STAGES = ["new", "qualified", "proposal", "won", "lost"];

// ---- projection helper (kept for shape parity with your UI) ----
const baseLeadShape = (overrides = {}) => ({
  id: randomUUID(),
  tenant_id: null,
  company_id: null,
  owner_id: null,
  name: "",
  company_name: null,
  email: null,
  phone: null,
  website: null,
  source: null,
  status: "new",
  stage: null,
  owner_name: null,
  score: null,
  priority: null,
  tags_text: null,
  followup_at: null,
  created_at: nowISO(),
  updated_at: nowISO(),
  ai_summary: null,
  ai_next: [],
  ai_score: null,
  ai_next_action: null,
  ...overrides,
});

/* ---------------- probe ---------------- */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, mode: MODE, tenant_fallback: DEV_TENANT, company_fallback: DEV_COMPANY });
});

/* ---------------- list ---------------- */
router.get("/", (req, res) => {
  const tenantId = getTenantId(req);
  const companyId = getCompanyId(req);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? req.query.size, 10) || 25));
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim().toLowerCase();
  const stage = String(req.query.stage || "").trim().toLowerCase();
  const owner_id = String(req.query.owner_id || "").trim();

  let items = MEM.leads.filter(
    (l) => l.tenant_id === tenantId && (!companyId || l.company_id === companyId)
  );

  if (q) {
    items = items.filter((l) =>
      [l.name, l.company_name, l.email, l.phone].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }
  if (status) items = items.filter((l) => String(l.status || "").toLowerCase() === status);
  if (stage) items = items.filter((l) => String(l.stage || "").toLowerCase() === stage);
  if (owner_id) items = items.filter((l) => String(l.owner_id || "") === owner_id);

  items = items.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const offset = (page - 1) * size;
  const paged = items.slice(offset, offset + size);

  res.json({ items: paged, total: items.length, page, size });
});

/* ---------------- pipelines/stages ---------------- */
function computeStages(tenantId, companyId) {
  const stages = new Set(DEFAULT_STAGES);
  for (const l of MEM.leads) {
    if (l.tenant_id !== tenantId) continue;
    if (companyId && l.company_id !== companyId) continue;
    if (l.stage) stages.add(String(l.stage));
  }
  return Array.from(stages).sort((a, b) => a.localeCompare(b));
}

router.get("/pipelines", (req, res) => {
  const stages = computeStages(getTenantId(req), getCompanyId(req));
  res.json(stages);
});

router.get("/stages", (req, res) => {
  const stages = computeStages(getTenantId(req), getCompanyId(req));
  res.json(stages);
});

/* ---------------- check-mobile ---------------- */
router.get("/check-mobile", (req, res) => {
  const tenantId = getTenantId(req);
  const raw = String(req.query.phone ?? req.query.mobile ?? "").trim();
  if (!raw) return res.json({ exists: false, reason: "empty" });

  const pn = phoneNorm(raw);
  if (!pn) return res.json({ exists: false, reason: "invalid" });
  if (pn.length < 6) return res.json({ exists: false, reason: "too_short", phone_norm: pn });

  const hit = MEM.leads.find((l) => l.tenant_id === tenantId && phoneNorm(l.phone) === pn);
  return res.json({ exists: !!hit, lead: hit ? { id: hit.id, name: hit.name } : null, phone_norm: pn });
});

/* ---------------- create (NO DB) ---------------- */
router.post("/", upload.any(), (req, res) => {
  try {
    // NEVER 401 here; we fallback to dev tenant/company
    const tenantId = getTenantId(req);
    const companyId = getCompanyId(req);

    // normalize incoming
    const b = req.body || {};
    const pick = (...keys) => keys.map((k) => b[k]).find((v) => v !== undefined && v !== null);
    const name = String(pick("name", "title", "lead_name") || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const email = pick("email") ? String(b.email).trim() : null;
    const phone = pick("phone", "mobile") ? String(pick("phone", "mobile")).trim() : null;
    const website = pick("website") ? String(b.website).trim() : null;
    const source = pick("source") ? String(b.source).trim() : null;
    const status = pick("status") ? String(b.status).trim() : "new";
    const stage  = pick("stage")  ? String(b.stage).trim()  : null;
    const follow = pick("followup_at", "follow_up_date", "follow");
    const followup_at = follow ? new Date(String(follow).slice(0, 10)).toISOString() : null;

    // accept cfv in any of the formats; just echo back (no DB)
    const cfvRaw = b.cfv ?? null;
    let cfv = [];
    if (Array.isArray(cfvRaw)) cfv = cfvRaw;
    else if (cfvRaw && typeof cfvRaw === "object") {
      cfv = Object.entries(cfvRaw).map(([k, v]) => ({
        key: k,
        ...(typeof v === "object" && !Array.isArray(v) ? v : { value_text: v }),
      }));
    } else if (typeof cfvRaw === "string" && cfvRaw.trim()) {
      try {
        const parsed = JSON.parse(cfvRaw);
        cfv = Array.isArray(parsed) ? parsed : [parsed];
      } catch {}
    }

    const lead = baseLeadShape({
      tenant_id: tenantId,
      company_id: companyId,
      name,
      email,
      phone,
      website,
      source,
      status,
      stage,
      followup_at,
    });

    // attach echo/debug
    lead._echo = {
      body: b,
      cfv,
      files: (req.files || []).map((f) => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      })),
      note: "PANIC MODE: in-memory only (no DB writes)",
    };

    MEM.leads.push(lead);
    log("CREATE OK", { id: lead.id, name: lead.name, tenant: tenantId });

    return res.status(201).json(lead);
  } catch (err) {
    console.error("PANIC CREATE error:", err);
    return res.status(200).json({ ok: true, _note: "create failed but suppressed", message: err?.message });
  }
});

/* ---------------- fetch one (in-memory) ---------------- */
router.get("/:id", (req, res) => {
  const tenantId = getTenantId(req);
  const id = String(req.params.id);
  const hit = MEM.leads.find((l) => l.tenant_id === tenantId && l.id === id);
  if (!hit) return res.status(404).json({ error: "Lead not found (panic store)" });
  res.json(hit);
});

/* ---------------- update (in-memory) ---------------- */
router.patch("/:id", (req, res) => {
  const tenantId = getTenantId(req);
  const id = String(req.params.id);
  const idx = MEM.leads.findIndex((l) => l.tenant_id === tenantId && l.id === id);
  if (idx === -1) return res.status(404).json({ error: "Lead not found (panic store)" });

  const patch = req.body || {};
  const allow = new Set([
    "name","email","phone","source","followup_at","company_name","owner_name","website",
    "priority","tags_text","status","stage","owner_id","score","ai_summary","ai_next","ai_score"
  ]);

  const before = MEM.leads[idx];
  const after = { ...before };

  for (const [k, v] of Object.entries(patch)) {
    if (!allow.has(k)) continue;
    if (k === "followup_at") after.followup_at = v ? new Date(v).toISOString() : null;
    else if (k === "ai_next" && Array.isArray(v)) after.ai_next = v;
    else if (k === "priority") after.priority = v === "" || v == null ? null : Number(v);
    else after[k] = v;
  }

  // recompute phone_norm implicitly (used only in check-mobile)
  if (patch.phone !== undefined) {
    // nothing to store; phoneNorm is computed on the fly in check-mobile
  }

  after.updated_at = nowISO();
  MEM.leads[idx] = after;

  res.json(after);
});

export default router;
