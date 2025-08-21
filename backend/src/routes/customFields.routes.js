// backend/src/routes/custom_fields.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

// Accept tenant from session, header, or query — same behavior as leads routes
function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get?.("x-tenant-id") ||
    req.query?.tenant_id ||
    null
  );
}

function mapField(row) {
  const opts = row.options_json || {};
  const t = String(row.field_type || "text").toLowerCase();
  const type =
    ({
      text: "text",
      textarea: "textarea",
      number: "number",
      integer: "number",
      decimal: "number",
      money: "number",
      date: "date",
      datetime: "date",
      select: "select",
      dropdown: "select",
      checkbox: "checkbox",
      boolean: "checkbox",
      phone: "text",
      email: "text",
      file: "file",
      attachment: "file",
    }[t]) || "text";

  const options =
    Array.isArray(opts.options) ? opts.options :
    Array.isArray(opts.choices) ? opts.choices : [];

  const groupRaw = (opts.group || opts.ui_group || "general").toString().toLowerCase();
  const group = groupRaw === "advance" ? "advance" : "general";

  return {
    id: row.id,
    key: row.code,
    label: row.label,
    type,
    required: !!row.is_required,
    options,
    group,
    placeholder: row.placeholder || opts.placeholder || null,
    helpText: row.help_text || opts.helpText || null,
    accept: type === "file" ? (opts.accept || "*/*") : undefined,
    order: row.order_index ?? 1000,
  };
}

/**
 * GET /api/custom-fields?entity=lead
 * Public (no login), but requires tenant id (session/header/query).
 * Returns [] if tenant missing or no active form/version.
 */
router.get("/", async (req, res) => {
  const moduleName = String(req.query.module || "crm");
  const entityCode = String(req.query.entity || req.query.record_type || "lead");
  const tenantId = getTenantId(req);

  // Don’t 401 here; return [] so UI just shows “No custom fields yet”.
  if (!tenantId) return res.json([]);

  try {
    // Latest active version for this tenant + form (crm/lead)
    const { rows: vrows } = await pool.query(
      `
      SELECT v.id AS form_version_id
      FROM public.custom_forms f
      JOIN public.custom_form_versions v ON v.form_id = f.id
      WHERE f.tenant_id = $1
        AND f.module_name = $2
        AND f.code = $3
        AND v.status = 'active'
        AND (v.effective_to IS NULL OR v.effective_to > now())
      ORDER BY v.version DESC
      LIMIT 1
      `,
      [tenantId, moduleName, entityCode]
    );

    if (!vrows.length) return res.json([]);

    // Fields for that version (active only)
    const { rows } = await pool.query(
      `
      SELECT id, code, label, field_type, placeholder, help_text,
             options_json, validation_json, order_index, is_required
      FROM public.custom_fields
      WHERE form_version_id = $1
        AND is_active = true
      ORDER BY COALESCE(order_index, 1000), label, id
      `,
      [vrows[0].form_version_id]
    );

    res.json(rows.map(mapField));
  } catch (e) {
    console.error("[custom-fields] query failed:", e);
    res.status(500).json({ message: "Failed to load custom fields" });
  }
});

export default router;
