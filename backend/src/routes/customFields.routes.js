// src/routes/customFields.routes.js
// GET /api/crm/custom-fields?entity=lead&module=crm[&active_only=1]
// - Scopes by tenant (session or header x-tenant-id)
// - Finds latest ACTIVE form_version for (tenant, module, entity)
// - Falls back to latest version if no active version exists
// - Maps fields to the UI shape your drawer expects

import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

/* ---------------- helpers ---------------- */
function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get?.("x-tenant-id") ||
    req.query?.tenant_id ||
    null
  );
}

async function setTenant(client, tenantId) {
  // Persist on connection for RLS helpers (ensure_tenant_scope, etc.)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

function truthy(v) {
  return /^(1|true|yes|on)$/i.test(String(v ?? "").trim());
}

function mapField(row) {
  // options_json may be jsonb object or array, handle common patterns
  const opts = row.options_json || {};
  const rawType = String(row.field_type || "text").toLowerCase();

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
    }[rawType]) || "text";

  const options = Array.isArray(opts)
    ? opts
    : Array.isArray(opts.options)
    ? opts.options
    : Array.isArray(opts.choices)
    ? opts.choices
    : [];

  const groupRaw = String(opts.group ?? opts.ui_group ?? "general").toLowerCase();
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
    accept: type === "file" ? opts.accept || "*/*" : undefined,
    order: row.order_index ?? 1000,
  };
}

/* ---------------- route ---------------- */
/**
 * GET /api/crm/custom-fields?entity=lead&module=crm[&active_only=1]
 * Requires tenant context (session or x-tenant-id).
 * Returns: [{ id, key, label, type, required, options, group, placeholder, helpText, accept, order }]
 */
router.get("/custom-fields", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    // Match your prior behavior: return empty list (not 401) when tenant missing
    return res.json([]);
  }

  const moduleName = String(req.query.module || "crm").trim();
  const entityCode = String(req.query.entity || "lead").trim();
  const activeOnly = truthy(req.query.active_only ?? "1"); // default true

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    // 1) Try to get latest ACTIVE version for this tenant+module+entity
    const activeSql = `
      SELECT v.id AS form_version_id
      FROM public.custom_forms f
      JOIN public.custom_form_versions v ON v.form_id = f.id
      WHERE f.tenant_id = $1
        AND f.module_name = $2
        AND f.code = $3
        AND v.status = 'active'
        AND (v.effective_to IS NULL OR v.effective_to > now())
      ORDER BY v.version DESC NULLS LAST, v.created_at DESC NULLS LAST
      LIMIT 1
    `;
    const { rows: vrowsActive } = await client.query(activeSql, [
      tenantId,
      moduleName,
      entityCode,
    ]);

    let formVersionId = vrowsActive[0]?.form_version_id;

    // 1b) If no active version, fall back to latest ANY version
    if (!formVersionId) {
      const latestSql = `
        SELECT v.id AS form_version_id
        FROM public.custom_forms f
        JOIN public.custom_form_versions v ON v.form_id = f.id
        WHERE f.tenant_id = $1
          AND f.module_name = $2
          AND f.code = $3
        ORDER BY v.version DESC NULLS LAST, v.created_at DESC NULLS LAST
        LIMIT 1
      `;
      const { rows: vrowsLatest } = await client.query(latestSql, [
        tenantId,
        moduleName,
        entityCode,
      ]);
      formVersionId = vrowsLatest[0]?.form_version_id || null;
    }

    if (!formVersionId) {
      // No form exists yet for this tenant/module/entity
      return res.json([]);
    }

    // 2) Load fields for that version
    const fieldsSql = `
      SELECT
        id,
        code,
        label,
        field_type,
        placeholder,
        help_text,
        options_json,
        validation_json,
        order_index,
        is_required,
        is_active
      FROM public.custom_fields
      WHERE form_version_id = $1
        ${activeOnly ? "AND is_active = TRUE" : ""}
      ORDER BY COALESCE(order_index, 0) ASC, created_at ASC NULLS LAST, label ASC
    `;
    const { rows } = await client.query(fieldsSql, [formVersionId]);

    res.json((rows || []).map(mapField));
  } catch (err) {
    // Use req.log if you have pino-http; otherwise console.error
    try {
      req.log?.error({ err }, "GET /api/crm/custom-fields failed");
    } catch {}
    console.error("GET /api/crm/custom-fields error:", err);
    res.status(500).json({ message: "Failed to load custom fields" });
  } finally {
    client.release();
  }
});

export default router;
