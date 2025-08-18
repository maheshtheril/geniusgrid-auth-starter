// src/routes/admin.org.routes.js
import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/** pull tenant id from normalized session */
function getTenantId(req) {
  return (
    req.session?.tenantId ??
    req.session?.tenant_id ??
    req.session?.user?.tenantId ??
    null
  );
}

/** only allow these keys from the payload */
const ALLOWED_KEYS = new Set([
  "name", "legal_name", "domain", "industry", "about",
  "brand_color", "theme", "logo_url",
  "contact_name", "contact_email", "contact_phone",
  "support_email", "support_phone",
  "address1", "address2", "city", "state", "postal_code", "country",
  "timezone", "currency",
  "gstin", "pan", "cin",
  "website", "linkedin", "twitter", "facebook", "instagram", "youtube",
]);

/** default profile shape expected by the React page */
function defaultProfile() {
  return {
    name: "", legal_name: "", domain: "", industry: "", about: "",
    brand_color: "#5b6cff", theme: "dark", logo_url: "",
    contact_name: "", contact_email: "", contact_phone: "",
    support_email: "", support_phone: "",
    address1: "", address2: "", city: "", state: "", postal_code: "", country: "India",
    timezone: "Asia/Kolkata", currency: "INR",
    gstin: "", pan: "", cin: "",
    website: "", linkedin: "", twitter: "", facebook: "", instagram: "", youtube: "",
  };
}

/**
 * GET /api/admin/org-profile
 * Read-only from DB (public.tenants) + session overlay (no writes).
 */
router.get("/org-profile", requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "Not authenticated" });

  try {
    // Minimal, safe SELECT. We only pull fields we actually have.
    const sql = `
      SELECT id, code, name, currency
      FROM public.tenants
      WHERE id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [tenantId]);
    if (!rows.length) return res.status(404).json({ message: "Tenant not found" });

    const t = rows[0];
    // Base profile with DB-backed name/currency if present
    const base = defaultProfile();
    if (t.name) base.name = t.name;
    if (t.currency) base.currency = t.currency;

    // Overlay any previously saved session profile (no DB writes)
    const sessionProfile = req.session?.org_profile || {};
    const org = { ...base, ...sessionProfile };

    return res.json(org);
  } catch (err) {
    req.log?.error({ err }, "GET /api/admin/org-profile failed");
    return res.status(500).json({ message: "Failed to load org profile" });
  }
});

/**
 * PUT /api/admin/org-profile
 * NO DB WRITES: stores validated payload into the session (ephemeral).
 * Frontend already has a localStorage fallback via `safePut`, so this
 * gives you a 200 without touching the database.
 */
router.put("/org-profile", requireAuth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "Not authenticated" });

  const body = req.body || {};

  // pick only allowed keys & coerce to strings (or safe values)
  const next = {};
  for (const k of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    let v = body[k];
    if (v == null) v = "";
    if (typeof v !== "string") v = String(v);
    // small guardrails for very long values
    if (v.length > 2000) v = v.slice(0, 2000);
    next[k] = v;
  }

  // keep name/currency if provided; otherwise preserve existing
  const current = req.session.org_profile || {};
  const merged = { ...current, ...next };

  // save to the session (no DB)
  req.session.org_profile = merged;
  try {
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );
  } catch (err) {
    req.log?.error({ err }, "PUT /api/admin/org-profile session save failed");
    return res.status(500).json({ message: "Failed to save" });
  }

  return res.json(merged);
});

export default router;
