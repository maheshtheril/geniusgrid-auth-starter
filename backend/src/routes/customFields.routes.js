// src/routes/custom_fields.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

/* ------------ helpers (match leads.routes.js behavior) ------------ */
function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}
async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists on this connection (for ensure_tenant_scope() + RLS)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* ------------ field mapper for the frontend ------------ */
function mapField(row) {
  const t = String(row.field_type || "text").toLowerCase();
  const typeMap = {
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
  };
  const type = typeMap[t] || "text";

  const opts = row.options_json || {};
  const options = Array.isArray(opts.options)
    ? opts.options
    : Array.isArray(opts.choices)
    ? opts.choices
    : [];

  return {
    id: row.id,
    key: row.code,
    label: row.label,
    type,
    required: !!row.is_required,
    options,
    placeholder: row.placeholder || opts.placeholder || null,
    helpText: row.help_text || opts.helpText || null,
    accept: type === "file" ? (opts.accept || "*/*") : undefined,
    order_index: row.order_index ?? 0,
    is_active: row.is_active !== false,
  };
}

/**
 * GET /api/custom-fields?entity=lead&module=crm
 * Also accepts record_type=lead for compatibility.
 * Requires tenant via session, header x-tenant-id, or ?tenant_id.
 */
router.get("/custom-fields", async (req, res) => {
  const moduleName = String(req.query.module || "crm");
  const entityCode = String(req.query.entity || req.query.record_type || "lead");

  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json([]);

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    // 1) Latest active version for this tenant + form (module + code)
    const v = await client.query(
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
    if (!v.rowCount) return res.json([]); // no form configured

    // 2) Fields for that version
    const fields = await client.query(
      `
      SELECT id, code, label, field_type, placeholder, help_text,
             options_json, validation_json, order_index, is_required, is_active
        FROM public.custom_fields
       WHERE form_version_id = $1
         AND is_active = true
       ORDER BY COALESCE(order_index, 1000), created_at ASC
      `,
      [v.rows[0].form_version_id]
    );

    res.json(fields.rows.map(mapField));
  } catch (e) {
    console.error("GET /custom-fields failed:", e);
    res.status(500).json({ message: "Failed to load custom fields" });
  } finally {
    client.release();
  }
});

export default router;
