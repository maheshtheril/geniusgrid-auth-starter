// src/routes/customFields.js
import express from "express";
import { withClient } from "../db/pool.js";

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function pgSetContext(client, tenantId, userId) {
  // Safe no-op if unauthenticated; requireAuth should protect anyway.
  if (!tenantId || !userId) return;
  await client.query(
    `select set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)`,
    [String(tenantId), String(userId)]
  );
}

// Create/lookup form + an active version without relying on ON CONFLICT
async function ensureFormAndActiveVersion(client, tenantId, recordType) {
  // 1) Ensure form
  let formId;
  {
    const q = await client.query(
      `select id from public.custom_forms where tenant_id=$1 and code=$2 limit 1`,
      [tenantId, recordType]
    );
    formId = q.rows[0]?.id;

    if (!formId) {
      const ins = await client.query(
        `insert into public.custom_forms
           (tenant_id, module_name, code, name, is_active)
         values ($1,'crm',$2, initcap($2)||' Form', true)
         returning id`,
        [tenantId, recordType]
      );
      formId = ins.rows[0].id;
    }
  }

  // 2) Ensure active version
  let formVersionId;
  {
    const v = await client.query(
      `select id from public.custom_form_versions
         where tenant_id=$1 and form_id=$2
           and status='active' and effective_to is null
         order by version desc limit 1`,
      [tenantId, formId]
    );
    formVersionId = v.rows[0]?.id;

    if (!formVersionId) {
      const ins = await client.query(
        `insert into public.custom_form_versions
           (tenant_id, form_id, version, status, effective_from)
         values ($1,$2,1,'active', now())
         returning id`,
        [tenantId, formId]
      );
      formVersionId = ins.rows[0].id;
    }
  }

  return { formId, formVersionId };
}

function toJsonOrNull(x, fallback) {
  if (x === undefined) return fallback ?? null;
  return x;
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

// GET /api/custom-fields?record_type=lead
router.get("/", async (req, res) => {
  try {
    const recordType = String(req.query.record_type || "").trim().toLowerCase();
    if (!recordType) return res.status(400).json({ error: "record_type is required" });

    const tenantId = req.ctx?.tenantId;
    const userId   = req.ctx?.userId;
    if (!tenantId || !userId) return res.status(401).json({ error: "Not signed in" });

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const { formVersionId } = await ensureFormAndActiveVersion(client, tenantId, recordType);

      const { rows } = await client.query(
        `select id, code, label, field_type, placeholder, help_text,
                coalesce(options_json, '[]'::jsonb)    as options_json,
                coalesce(validation_json, '{}'::jsonb) as validation_json,
                order_index, is_required, is_active
           from public.custom_fields
          where tenant_id=$1 and form_version_id=$2
          order by order_index nulls last, label`,
        [tenantId, formVersionId]
      );

      res.json({ items: rows });
    });
  } catch (err) {
    req.log?.error({ err }, "GET /api/custom-fields failed");
    res.status(Number(err?.status || 500)).json({
      error: err?.message || "Server error",
      code: err?.code || null,
      detail: err?.detail || null,
      hint: err?.hint || null,
    });
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
    } = req.body || {};

    if (!record_type || !label || !code || !field_type) {
      return res.status(400).json({ error: "record_type, label, code, field_type are required" });
    }

    const tenantId = req.ctx?.tenantId;
    const userId   = req.ctx?.userId;
    if (!tenantId || !userId) return res.status(401).json({ error: "Not signed in" });

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const { formVersionId } = await ensureFormAndActiveVersion(
        client, tenantId, String(record_type).toLowerCase()
      );

      const { rows: ord } = await client.query(
        `select coalesce(max(order_index), 0)+1 as next_order
           from public.custom_fields
          where tenant_id=$1 and form_version_id=$2`,
        [tenantId, formVersionId]
      );
      const nextOrder = Number(ord[0]?.next_order || 1);

      const { rows } = await client.query(
        `insert into public.custom_fields
           (tenant_id, form_version_id, code, label, field_type,
            placeholder, help_text, options_json, validation_json,
            order_index, is_required, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning id, code, label, field_type, placeholder, help_text,
                   coalesce(options_json,'[]'::jsonb)    as options_json,
                   coalesce(validation_json,'{}'::jsonb) as validation_json,
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
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Field already exists", detail: err.detail || null });
    }
    req.log?.error({ err }, "POST /api/custom-fields failed");
    res.status(Number(err?.status || 500)).json({ error: err?.message || "Server error" });
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

    const tenantId = req.ctx?.tenantId;
    const userId   = req.ctx?.userId;
    if (!tenantId || !userId) return res.status(401).json({ error: "Not signed in" });

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
        `update public.custom_fields
            set ${sets.join(", ")}
          where tenant_id = $${vals.length - 1}
            and id = $${vals.length}
          returning id, code, label, field_type, placeholder, help_text,
                    coalesce(options_json,'[]'::jsonb)    as options_json,
                    coalesce(validation_json,'{}'::jsonb) as validation_json,
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
    req.log?.error({ err }, "PUT /api/custom-fields/:id failed");
    res.status(Number(err?.status || 500)).json({ error: err?.message || "Server error" });
  }
});

// DELETE /api/custom-fields/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = req.ctx?.tenantId;
    const userId   = req.ctx?.userId;
    if (!tenantId || !userId) return res.status(401).json({ error: "Not signed in" });

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      await client.query(
        `delete from public.custom_field_values where tenant_id=$1 and field_id=$2`,
        [tenantId, id]
      );
      const { rowCount } = await client.query(
        `delete from public.custom_fields where tenant_id=$1 and id=$2`,
        [tenantId, id]
      );

      if (!rowCount) return res.status(404).json({ error: "Field not found" });
      res.json({ ok: true });
    });
  } catch (err) {
    req.log?.error({ err }, "DELETE /api/custom-fields/:id failed");
    res.status(Number(err?.status || 500)).json({ error: err?.message || "Server error" });
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

    const tenantId = req.ctx?.tenantId;
    const userId   = req.ctx?.userId;
    if (!tenantId || !userId) return res.status(401).json({ error: "Not signed in" });

    await withClient(async (client) => {
      await pgSetContext(client, tenantId, userId);

      const { formVersionId } = await ensureFormAndActiveVersion(
        client, tenantId, String(record_type).toLowerCase()
      );

      await client.query(
        `
        with input as (
          select (x->>'id')::uuid as id, (x->>'order_index')::int as order_index
          from jsonb_array_elements($1::jsonb) as x
        )
        update public.custom_fields f
           set order_index = i.order_index
          from input i
         where f.tenant_id = $2
           and f.form_version_id = $3
           and f.id = i.id
        `,
        [JSON.stringify(order), tenantId, formVersionId]
      );

      res.json({ ok: true });
    });
  } catch (err) {
    req.log?.error({ err }, "PUT /api/custom-fields/reorder failed");
    res.status(Number(err?.status || 500)).json({ error: err?.message || "Server error" });
  }
});

export default router;
