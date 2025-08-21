// src/routes/customFields.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const router = Router();

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
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

function truthy(v) { return /^(1|true|yes|on)$/i.test(String(v ?? "").trim()); }

function mapField(row) {
  const opts = row.options_json || {};
  const rawType = String(row.field_type || "text").toLowerCase();
  const type = ({
    text:"text", textarea:"textarea", number:"number", integer:"number", decimal:"number", money:"number",
    date:"date", datetime:"date", select:"select", dropdown:"select", checkbox:"checkbox", boolean:"checkbox",
    phone:"text", email:"text", file:"file", attachment:"file",
  }[rawType]) || "text";

  const options = Array.isArray(opts)
    ? opts
    : Array.isArray(opts.options) ? opts.options
    : Array.isArray(opts.choices) ? opts.choices
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
    accept: type === "file" ? (opts.accept || "*/*") : undefined,
    order_index: row.order_index ?? 1000,
  };
}

/**
 * GET /api/crm/custom-fields?entity=lead&module=crm[&active_only=1]
 * Returns [] if tenant missing.
 */
router.get("/custom-fields", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.json([]);

  const moduleName = String(req.query.module || "crm").trim();
  const entityCode = String(req.query.entity || "lead").trim();
  const activeOnly = truthy(req.query.active_only ?? "1");

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    // 1) Try ACTIVE version
    const { rows: vActive } = await client.query(
      `
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
      `,
      [tenantId, moduleName, entityCode]
    );

    let formVersionId = vActive[0]?.form_version_id;

    // 2) Fallback to LATEST version if no active
    if (!formVersionId) {
      const { rows: vLatest } = await client.query(
        `
        SELECT v.id AS form_version_id
        FROM public.custom_forms f
        JOIN public.custom_form_versions v ON v.form_id = f.id
        WHERE f.tenant_id = $1
          AND f.module_name = $2
          AND f.code = $3
        ORDER BY v.version DESC NULLS LAST, v.created_at DESC NULLS LAST
        LIMIT 1
        `,
        [tenantId, moduleName, entityCode]
      );
      formVersionId = vLatest[0]?.form_version_id || null;
    }

    // 3) If we found a version, return its fields
    if (formVersionId) {
      const { rows } = await client.query(
        `
        SELECT id, code, label, field_type, placeholder, help_text,
               options_json, validation_json, order_index, is_required, is_active
        FROM public.custom_fields
        WHERE form_version_id = $1
          ${activeOnly ? "AND is_active = TRUE" : ""}
        ORDER BY COALESCE(order_index,0) ASC, created_at ASC NULLS LAST, label ASC
        `,
        [formVersionId]
      );
      return res.json((rows || []).map(mapField));
    }

    // 4) Final fallback: return all tenant fields (no forms wired yet)
    const { rows: tenantFields } = await client.query(
      `
      SELECT id, code, label, field_type, placeholder, help_text,
             options_json, validation_json, order_index, is_required, is_active
      FROM public.custom_fields
      WHERE tenant_id = $1
        ${activeOnly ? "AND is_active = TRUE" : ""}
      ORDER BY COALESCE(order_index,0) ASC, created_at ASC NULLS LAST, label ASC
      `,
      [tenantId]
    );
    return res.json((tenantFields || []).map(mapField));
  } catch (err) {
    try { req.log?.error({ err }, "GET /api/crm/custom-fields failed"); } catch {}
    console.error("GET /api/crm/custom-fields error:", err);
    res.status(500).json({ message: "Failed to load custom fields" });
  } finally {
    client.release();
  }
});

export default router;
