// src/routes/customFields.js
import express from "express";
import { withClient } from "../db/pool.js";

const router = express.Router();

/* ---------------- helpers ---------------- */

async function pgSetContext(client, tenantId, userId) {
  if (!tenantId || !userId) return; // no-op if unauth
  await client.query(
    `select
       set_config('app.tenant_id', $1, true),
       set_config('app.user_id',   $2, true)`,
    [String(tenantId), String(userId)]
  );
}

async function ensureFormAndActiveVersion(client, tenantId, recordType, req) {
  // 1) form: need a unique constraint to support ON CONFLICT
  const insFormSQL = `
    insert into public.custom_forms (tenant_id, module_name, code, name, is_active)
    values ($1, 'crm', $2, initcap($2)||' Form', true)
    on conflict (tenant_id, code) do nothing
    returning id
  `;
  const { rows: formRows } = await client.query(insFormSQL, [tenantId, recordType]);

  let formId;
  if (formRows.length) {
    formId = formRows[0].id;
  } else {
    const { rows } = await client.query(
      `select id from public.custom_forms
       where tenant_id=$1 and code=$2
       order by id desc limit 1`,
      [tenantId, recordType]
    );
    formId = rows[0]?.id;
  }

  if (!formId) {
    req?.log?.error({ tenantId, recordType }, "custom_forms not found/created");
    throw Object.assign(new Error("Form not found/created"), { status: 500 });
  }

  // 2) active version
  const { rows: verRows } = await client.query(
    `select id from public.custom_form_versions
       where tenant_id=$1 and form_id=$2
         and status='active' and effective_to is null
       order by version desc
       limit 1`,
    [tenantId, formId]
  );

  if (verRows.length) return { formId, formVersionId: verRows[0].id };

  const { rows: created } = await client.query(
    `insert into public.custom_form_versions
       (tenant_id, form_id, version, status, effective_from)
     values ($1,$2,1,'active', now())
     returning id`,
    [tenantId, formId]
  );

  return { formId, formVersionId: created[0].id };
}

/* ---------------- routes ---------------- */

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

      const { formVersionId } = await ensureFormAndActiveVersion(client, tenantId, recordType, req);

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
      code: err?.code || undefined,
      detail: err?.detail || undefined,
      hint: err?.hint || undefined,
    });
  }
});

export default router;
