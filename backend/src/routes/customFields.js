// api/routes/customFields.js
import express from "express";
import { withClient } from "../db/pool.js";

const router = express.Router();

/** ------------------------------ helpers ------------------------------ **/

async function pgSetContext(client, tenantId, userId) {
  // Set per-request context (used by your DB helpers/views)
  await client.query(`SELECT
    set_config('app.tenant_id', $1, true),
    set_config('app.user_id',   $2, true)`,
    [tenantId, userId]);
}

// Make sure we have a form + an active version to hold fields for this record_type
async function ensureFormAndActiveVersion(client, tenantId, recordType) {
  // 1) find/create form (module_name can be 'crm'; code = recordType)
  const { rows: formRows } = await client.query(
    `INSERT INTO public.custom_forms (tenant_id, module_name, code, name, is_active)
     VALUES ($1,'crm',$2, initcap($2)||' Form', true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [tenantId, recordType]
  );
  let formId;
  if (formRows.length) {
    formId = formRows[0].id;
  } else {
    const { rows } = await client.query(
      `SELECT id FROM public.custom_forms
       WHERE tenant_id=$1 AND code=$2 LIMIT 1`,
      [tenantId, recordType]
    );
    formId = rows[0]?.id;
  }

  // 2) find/create active version (status='active', no effective_to)
  const { rows: verRows } = await client.query(
    `SELECT id FROM public.custom_form_versions
       WHERE tenant_id=$1 AND form_id=$2
         AND status='active' AND effective_to IS NULL
       ORDER BY version DESC LIMIT 1`,
    [tenantId, formId]
  );
  if (verRows.length) return { formId, formVersionId: verRows[0].id };

  const { rows: created } = await client.query(
    `INSERT INTO public.custom_form_versions
       (tenant_id, form_id, version, status, effective_from)
     VALUES ($1,$2,1,'active', now())
     RETURNING id`,
    [tenantId, formId]
  );
  return { formId, formVersionId: created[0].id };
}

/** ------------------------------ routes ------------------------------ **/

// GET /api/custom-fields?record_type=lead
router.get("/", async (req, res) => {
  const recordType = String(req.query.record_type || "").trim().toLowerCase();
  if (!recordType) return res.status(400).json({ message: "record_type is required" });

  await withClient(async (client) => {
    await pgSetContext(client, req.ctx.tenantId, req.ctx.userId);
    const { formVersionId } = await ensureFormAndActiveVersion(client, req.ctx.tenantId, recordType);

    const { rows } = await client.query(
      `SELECT id, code, label, field_type, placeholder, help_text,
              COALESCE(options_json, '[]'::jsonb) AS options_json,
              COALESCE(validation_json, '{}'::jsonb) AS validation_json,
              order_index, is_required, is_active
         FROM public.custom_fields
        WHERE tenant_id=$1 AND form_version_id=$2
        ORDER BY order_index NULLS LAST, label`,
      [req.ctx.tenantId, formVersionId]
    );
    res.json({ items: rows });
  });
});

// POST /api/custom-fields
router.post("/", async (req, res) => {
  const {
    record_type, label, code, field_type,
    placeholder = null, help_text = null,
    options_json = [], validation_json = {},
    is_required = false, is_active = true,
    default_value, visibility, // ignored (not in schema)
  } = req.body || {};

  if (!record_type || !label || !code || !field_type) {
    return res.status(400).json({ message: "record_type, label, code, field_type are required" });
  }

  await withClient(async (client) => {
    await pgSetContext(client, req.ctx.tenantId, req.ctx.userId);
    const { formVersionId } = await ensureFormAndActiveVersion(client, req.ctx.tenantId, String(record_type).toLowerCase());

    // compute order_index = max+1
    const { rows: ord } = await client.query(
      `SELECT COALESCE(MAX(order_index), 0)+1 AS next_order
         FROM public.custom_fields
        WHERE tenant_id=$1 AND form_version_id=$2`,
      [req.ctx.tenantId, formVersionId]
    );

    const { rows } = await client.query(
      `INSERT INTO public.custom_fields
         (tenant_id, form_version_id, code, label, field_type,
          placeholder, help_text, options_json, validation_json,
          order_index, is_required, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, code, label, field_type, placeholder, help_text,
                 COALESCE(options_json,'[]'::jsonb) AS options_json,
                 COALESCE(validation_json,'{}'::jsonb) AS validation_json,
                 order_index, is_required, is_active`,
      [
        req.ctx.tenantId, formVersionId, code.trim(), label.trim(), field_type.trim(),
        placeholder, help_text, options_json, validation_json,
        ord[0].next_order, !!is_required, !!is_active,
      ]
    );

    res.status(201).json(rows[0]);
  });
});

// PUT /api/custom-fields/:id
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const {
    label, // optional
    code,  // optional (UI warns against changing; we still allow)
    field_type, placeholder = null, help_text = null,
    options_json = undefined, validation_json = undefined,
    is_required = undefined, is_active = undefined,
  } = req.body || {};

  await withClient(async (client) => {
    await pgSetContext(client, req.ctx.tenantId, req.ctx.userId);

    // Build dynamic update
    const sets = [];
    const vals = [];
    function set(col, val) { sets.push(`${col} = $${vals.length + 1}`); vals.push(val); }

    if (label !== undefined) set("label", label);
    if (code  !== undefined) set("code", code);
    if (field_type !== undefined) set("field_type", field_type);
    if (placeholder !== undefined) set("placeholder", placeholder);
    if (help_text !== undefined) set("help_text", help_text);
    if (options_json !== undefined) set("options_json", options_json);
    if (validation_json !== undefined) set("validation_json", validation_json);
    if (is_required !== undefined) set("is_required", !!is_required);
    if (is_active !== undefined) set("is_active", !!is_active);

    if (!sets.length) return res.json({ ok: true });

    vals.push(req.ctx.tenantId, id);

    const { rows } = await client.query(
      `UPDATE public.custom_fields
          SET ${sets.join(", ")}
        WHERE tenant_id = $${vals.length - 1} AND id = $${vals.length}
        RETURNING id, code, label, field_type, placeholder, help_text,
                  COALESCE(options_json,'[]'::jsonb) AS options_json,
                  COALESCE(validation_json,'{}'::jsonb) AS validation_json,
                  order_index, is_required, is_active`,
      vals
    );

    if (!rows.length) return res.status(404).json({ message: "Field not found" });
    res.json(rows[0]);
  });
});

// DELETE /api/custom-fields/:id
router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  await withClient(async (client) => {
    await pgSetContext(client, req.ctx.tenantId, req.ctx.userId);

    // Clean values then delete field (no FK in schema)
    await client.query(
      `DELETE FROM public.custom_field_values WHERE tenant_id=$1 AND field_id=$2`,
      [req.ctx.tenantId, id]
    );
    const { rowCount } = await client.query(
      `DELETE FROM public.custom_fields WHERE tenant_id=$1 AND id=$2`,
      [req.ctx.tenantId, id]
    );
    if (!rowCount) return res.status(404).json({ message: "Field not found" });
    res.json({ ok: true });
  });
});

// PUT /api/custom-fields/reorder
// body: { record_type, order: [{id, order_index}] }
router.put("/reorder", async (req, res) => {
  const { record_type, order } = req.body || {};
  if (!record_type || !Array.isArray(order)) {
    return res.status(400).json({ message: "record_type and order[] required" });
  }

  await withClient(async (client) => {
    await pgSetContext(client, req.ctx.tenantId, req.ctx.userId);
    const { formVersionId } = await ensureFormAndActiveVersion(client, req.ctx.tenantId, String(record_type).toLowerCase());

    // Only update rows that belong to this tenant+version
    await client.query(
      `
      WITH input AS (
        SELECT (x->>'id')::uuid AS id, (x->>'order_index')::int AS order_index
        FROM jsonb_array_elements($1::jsonb) AS x
      )
      UPDATE public.custom_fields f
         SET order_index = i.order_index
        FROM input i
       WHERE f.tenant_id = $2
         AND f.form_version_id = $3
         AND f.id = i.id
      `,
      [JSON.stringify(order), req.ctx.tenantId, formVersionId]
    );

    res.json({ ok: true });
  });
});

export default router;
