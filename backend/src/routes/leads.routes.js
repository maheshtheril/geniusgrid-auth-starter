// src/routes/leads.routes.js (PANIC MODE: no DB calls, no 500s)
// Mount path: /api/leads

import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";

const router = express.Router();

// ensure JSON / urlencoded parsing even if app.js forgot it
router.use(express.json({ limit: "2mb" }));
router.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
});

const log = (...a) => {
  if (process.env.NODE_ENV !== "production") console.log("[PANIC /api/leads]", ...a);
};

// simple helper
const nowISO = () => new Date().toISOString();

/* ---------------- probe ---------------- */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, mode: "panic", note: "DB disabled; routes stubbed" });
});

/* ---------------- list ---------------- */
router.get("/", (req, res) => {
  log("LIST", req.query);
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page || 1),
    size: Number(req.query.pageSize || req.query.size || 25),
  });
});

/* ---------------- pipelines/stages ---------------- */
router.get("/pipelines", (_req, res) => res.json(["new", "qualified", "proposal", "won", "lost"]));
router.get("/stages", (_req, res) => res.json(["new", "qualified", "proposal", "won", "lost"]));

/* ---------------- check-mobile ---------------- */
router.get("/check-mobile", (req, res) => {
  const raw = String(req.query.phone ?? req.query.mobile ?? "").trim();
  if (!raw) return res.json({ exists: false, reason: "empty" });
  const pn = raw.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (!pn || pn.length < 6) return res.json({ exists: false, reason: "too_short", phone_norm: pn });
  res.json({ exists: false, phone_norm: pn, lead: null });
});

/* ---------------- create (NO DB) ---------------- */
router.post("/", upload.any(), (req, res) => {
  try {
    const tenantId = req.get("x-tenant-id") || req.query.tenant_id || null;
    if (!tenantId) return res.status(401).json({ error: "No tenant" });

    // normalize incoming
    const b = req.body || {};
    const pick = (...keys) => keys.map(k => b[k]).find(v => v !== undefined && v !== null);
    const name = String(pick("name", "title", "lead_name") || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const email = pick("email") ? String(b.email).trim() : null;
    const phone = pick("phone", "mobile") ? String(pick("phone", "mobile")).trim() : null;
    const website = pick("website") ? String(b.website).trim() : null;
    const source = pick("source") ? String(b.source).trim() : null;
    const status = pick("status") ? String(b.status).trim() : "new";
    const stage  = pick("stage")  ? String(b.stage).trim()  : null;

    // accept cfv in any of the formats; just echo back (no DB)
    const cfvRaw = b.cfv ?? null;
    let cfv = [];
    if (Array.isArray(cfvRaw)) cfv = cfvRaw;
    else if (cfvRaw && typeof cfvRaw === "object") cfv = Object.entries(cfvRaw).map(([k, v]) => ({ key: k, ...((typeof v === "object" && !Array.isArray(v)) ? v : { value_text: v }) }));
    else if (typeof cfvRaw === "string" && cfvRaw.trim()) {
      try { const parsed = JSON.parse(cfvRaw); cfv = Array.isArray(parsed) ? parsed : [parsed]; } catch {}
    }

    const id = randomUUID();
    const created = {
      id,
      tenant_id: tenantId,
      company_id: req.get("x-company-id") || req.query.company_id || null,
      owner_id: null,
      name,
      company_name: null,
      email,
      phone,
      website,
      source,
      status,
      stage,
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
      _echo: {
        body: b,
        cfv,
        files: (req.files || []).map(f => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
        })),
      },
      _note: "PANIC MODE: this is a stubbed object (no DB writes)",
    };

    log("CREATE OK", { name, email, phone, cfv_len: cfv.length });
    return res.status(201).json(created);
  } catch (err) {
    console.error("PANIC CREATE error:", err);
    return res.status(500).json({ error: "panic_create_failed", message: err?.message });
  }
});

/* ---------------- fetch one (stub) ---------------- */
router.get("/:id", (req, res) => {
  const id = req.params.id;
  res.json({
    id,
    tenant_id: req.get("x-tenant-id") || null,
    company_id: req.get("x-company-id") || null,
    owner_id: null,
    name: "Stub Lead",
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
    _note: "PANIC MODE: stubbed record",
  });
});

/* ---------------- update (stub) ---------------- */
router.patch("/:id", (req, res) => {
  res.json({ ok: true, id: req.params.id, patch: req.body, _note: "PANIC MODE: no DB update performed" });
});

export default router;
