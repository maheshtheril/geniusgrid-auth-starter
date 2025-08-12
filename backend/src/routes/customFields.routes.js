// Uses custom_forms → custom_form_versions → custom_fields
import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

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
 * GET /api/crm/custom-fields?entity=lead&module=crm
 * Needs a tenant in session (req.session.tenantId).
 */
router.get("/custom-fields", async (req, res) => {
  const moduleName = String(req.query.module || "crm");
  const entityCode = String(req.query.entity || "lead");
  const tenantId =
    req.session?.tenantId || req.session?.tenant_id || null;

  // Require tenant context to avoid leaking other tenants’ form
  if (!tenantId) return res.json([]);

  try {
    // 1) Find the latest active version for this tenant + form
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

    if (!vrows.length) return res.json([]); // no form yet

    // 2) Load fields for that version
    const { rows } = await pool.query(
      `
      SELECT id, code, label, field_type, placeholder, help_text,
             options_json, validation_json, order_index, is_required
      FROM public.custom_fields
      WHERE form_version_id = $1
        AND is_active = true
      ORDER BY order_index ASC, created_at ASC
      `,
      [vrows[0].form_version_id]
    );

    res.json(rows.map(mapField));
  } catch (e) {
    req.log?.error({ err: e }, "custom-fields query failed");
    res.status(500).json({ message: "Failed to load custom fields" });
  }
});

export default router;
