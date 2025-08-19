// api/routes/customFields.js
import express from "express";
import { withClient } from "../db/pool.js";

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function pgSetContext(client, tenantId, userId) {
  // No-op if unauthenticated (prevents throws)
  if (!tenantId || !userId) return;
  await client.query(
    `SELECT
       set_config('app.tenant_id', $1, true),
       set_config('app.user_id',   $2, true)`,
    [String(tenantId), String(userId)]
  );
}

// Ensure we have a form + an active version to hold fields for this record_type
async function ensureFormAndActiveVersion(client, tenantId, recordType) {
  // 1) find/create form (module_name 'crm'; code = recordType)
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
       WHERE tenant_id=$1 AND code=$2
       ORDER BY id DESC LIMIT 1`,
      [tenantId, recordType]
    );
    formId = rows[0]?.id;
  }
  if (!formId) throw Object.assign(new Error("Form not found/created"), { status: 500 });

  // 2) find/create active version (status='active', no effective_to)
  const { rows: verRows } = await client.query(
    `SELECT id FROM public.custom_form_versions
       WHERE tenant_id=$1 AND form_id=$2
         AND status='active' AND effective_to IS NULL
       ORDER BY version DESC
       LIMIT 1`,
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

function requireAuthCtx(req, res) {
  const ctx = req.ctx || {};
  const { tenantId, userId } = ctx;
  if (!tenantId || !userId) {
    res.status(401).json({ error: "Not signed in" });
    return null;
  }
  return ctx;
}

function toJsonOrNull(x, fallback) {
  // Ensure we pass proper JSON to PG; pg can serialize objects/arrays, but keep consistent.
  if (x === undefined) return fallback ?? null;
  return x;
}

function handleRouteError(res, err) {
  const status = Number(err?.status || 500);
  res.status(status).json({ error: err?.message || "Server error" });
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

// GET /api/custom-fields?record_type=lead
router.get("/", async (req, res) => {
  try {
    const recordType = String(req.query.record_type || "").trim().toLowerCase();
    if (!recordType) return res.status(400).json({ error: "record_type is required" });

    const ctx = requireAuthCtx(req, res);
    if (!ctx) return; // 401 already sent
    const { tenantId, userId } = ctx;

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const { formVersionId } = await ensureFormAndActiveVersion(client, tenantId, recordType);

      const { rows } = await client.query(
        `SELECT id, code, label, field_type, placeholder, help_text,
                COALESCE(options_json, '[]'::jsonb)     AS options_json,
                COALESCE(validation_json, '{}'::jsonb)  AS validation_json,
                order_index, is_required, is_active
           FROM public.custom_fields
          WHERE tenant_id=$1 AND form_version_id=$2
          ORDER BY order_index NULLS LAST, label`,
        [tenantId, formVersionId]
      );

      res.json({ items: rows });
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// POST /api/custom-fields
router.post("/", async (req, res) => {
  try {
    const {
      record_type, label, code, field_type,
      placeholder = null, help_text = null,
      options_json = [], validation_json = {},
      is_required = false, is_active = true,
      // default_value, visibility // ignored (not in schema)
    } = req.body || {};

    if (!record_type || !label || !code || !field_type) {
      return res.status(400).json({ error: "record_type, label, code, field_type are required" });
    }

    const ctx = requireAuthCtx(req, res);
    if (!ctx) return;
    const { tenantId, userId } = ctx;

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const { formVersionId } = await ensureFormAndActiveVersion(
        client,
        tenantId,
        String(record_type).toLowerCase()
      );

      // next order_index
      const { rows: ord } = await client.query(
        `SELECT COALESCE(MAX(order_index), 0)+1 AS next_order
           FROM public.custom_fields
          WHERE tenant_id=$1 AND form_version_id=$2`,
        [tenantId, formVersionId]
      );
      const nextOrder = Number(ord[0]?.next_order || 1);

      const { rows } = await client.query(
        `INSERT INTO public.custom_fields
           (tenant_id, form_version_id, code, label, field_type,
            placeholder, help_text, options_json, validation_json,
            order_index, is_required, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, code, label, field_type, placeholder, help_text,
                   COALESCE(options_json,'[]'::jsonb)    AS options_json,
                   COALESCE(validation_json,'{}'::jsonb) AS validation_json,
                   order_index, is_required, is_active`,
        [
          tenantId, formVersionId,
          String(code).trim(),
          String(label).trim(),
          String(field_type).trim(),
          placeholder,
          help_text,
          toJsonOrNull(options_json, []),
          toJsonOrNull(validation_json, {}),
          nextOrder,
          !!is_required,
          !!is_active,
        ]
      );

      res.status(201).json(rows[0]);
    });
  } catch (err) {
    // Unique constraint, etc.
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Field already exists", detail: err.detail || null });
    }
    handleRouteError(res, err);
  }
});

// PUT /api/custom-fields/:id
router.put("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    const {
      label, code, field_type,
      placeholder = null, help_text = null,
      options_json = undefined, validation_json = undefined,
      is_required = undefined, is_active = undefined,
    } = req.body || {};

    const ctx = requireAuthCtx(req, res);
    if (!ctx) return;
    const { tenantId, userId } = ctx;

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const sets = [];
      const vals = [];
      const add = (col, val) => { sets.push(`${col} = $${vals.length + 1}`); vals.push(val); };

      if (label !== undefined)        add("label", label);
      if (code !== undefined)         add("code", code);
      if (field_type !== undefined)   add("field_type", field_type);
      if (placeholder !== undefined)  add("placeholder", placeholder);
      if (help_text !== undefined)    add("help_text", help_text);
      if (options_json !== undefined) add("options_json", toJsonOrNull(options_json, []));
      if (validation_json !== undefined) add("validation_json", toJsonOrNull(validation_json, {}));
      if (is_required !== undefined)  add("is_required", !!is_required);
      if (is_active !== undefined)    add("is_active", !!is_active);

      if (!sets.length) return res.json({ ok: true });

      vals.push(tenantId, id);

      const { rows } = await client.query(
        `UPDATE public.custom_fields
            SET ${sets.join(", ")}
          WHERE tenant_id = $${vals.length - 1}
            AND id = $${vals.length}
          RETURNING id, code, label, field_type, placeholder, help_text,
                    COALESCE(options_json,'[]'::jsonb)    AS options_json,
                    COALESCE(validation_json,'{}'::jsonb) AS validation_json,
                    order_index, is_required, is_active`,
        vals
      );

      if (!rows.length) return res.status(404).json({ error: "Field not found" });
      res.json(rows[0]);
    });
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Field already exists", detail: err.detail || null });
    }
    handleRouteError(res, err);
  }
});

// DELETE /api/custom-fields/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);

    const ctx = requireAuthCtx(req, res);
    if (!ctx) return;
    const { tenantId, userId } = ctx;

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      await client.query(
        `DELETE FROM public.custom_field_values
          WHERE tenant_id=$1 AND field_id=$2`,
        [tenantId, id]
      );
      const { rowCount } = await client.query(
        `DELETE FROM public.custom_fields
          WHERE tenant_id=$1 AND id=$2`,
        [tenantId, id]
      );

      if (!rowCount) return res.status(404).json({ error: "Field not found" });
      res.json({ ok: true });
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// PUT /api/custom-fields/reorder
// body: { record_type, order: [{id, order_index}] }
router.put("/reorder", async (req, res) => {
  try {
    const { record_type, order } = req.body || {};
    if (!record_type || !Array.isArray(order)) {
      return res.status(400).json({ error: "record_type and order[] required" });
    }

    const ctx = requireAuthCtx(req, res);
    if (!ctx) return;
    const { tenantId, userId } = ctx;

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const { formVersionId } = await ensureFormAndActiveVersion(
        client,
        tenantId,
        String(record_type).toLowerCase()
      );

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
        [JSON.stringify(order), tenantId, formVersionId]
      );

      res.json({ ok: true });
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

export default router;
