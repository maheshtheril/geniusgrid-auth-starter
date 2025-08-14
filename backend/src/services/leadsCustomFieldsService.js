// 📄 src/services/leadsCustomFieldsService.js
import { pool } from "../db/pool.js";

/** Set tenant scope for RLS on this specific PG connection. */
async function setTenantScope(client, tenantId) {
  // Set multiple GUC keys so whatever ensure_tenant_scope() reads will match.
  // All are LOCAL to this connection (true).
  await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("select set_config('request.jwt.claims.tenant_id', $1, true)", [tenantId]);
  await client.query("select set_config('request.tenant_id', $1, true)", [tenantId]);
}

/** Optional: expose current GUC values for debugging */
export async function getTenantDebugInfo(tenantId) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const { rows } = await client.query(
      `
      select
        current_setting('app.tenant_id', true) as app_tenant_id,
        current_setting('request.jwt.claims.tenant_id', true) as jwt_tenant_id,
        current_setting('request.tenant_id', true) as req_tenant_id
      `
    );
    return rows?.[0] || {};
  } finally {
    client.release();
  }
}

/** Ensure/return the ACTIVE Leads form version id (per-tenant). */
export async function getActiveLeadsFormVersionId(tenantId) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);

    // 1) ensure the form row exists
    const formRes = await client.query(
      `
      insert into custom_forms (tenant_id, module_name, code, name)
      values ($1, 'crm', 'leads', 'Leads Form')
      on conflict (tenant_id, module_name, code)
      do update set name = excluded.name
      returning id;
      `,
      [tenantId]
    );
    const formId = formRes.rows[0].id;

    // 2) get active version or create v1 (proper CTE; no "select from (insert ...)")
    const verRes = await client.query(
      `
      with got as (
        select id
        from custom_form_versions
        where tenant_id = $1 and form_id = $2 and status = 'active'
        order by version desc
        limit 1
      ),
      ins as (
        insert into custom_form_versions (tenant_id, form_id, version, status)
        select $1, $2, 1, 'active'
        where not exists (select 1 from got)
        returning id
      )
      select id from got
      union all
      select id from ins
      limit 1;
      `,
      [tenantId, formId]
    );

    return verRes.rows[0].id;
  } finally {
    client.release();
  }
}

/** List active fields for a form version. */
export async function listFieldsByFormVersion(tenantId, formVersionId) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const { rows } = await client.query(
      `
      select id, code, label, field_type, placeholder, help_text,
             options_json, validation_json, order_index, is_required, is_active
      from custom_fields
      where tenant_id = $1 and form_version_id = $2 and is_active = true
      order by order_index, label;
      `,
      [tenantId, formVersionId]
    );
    return rows;
  } finally {
    client.release();
  }
}

/** Upsert a field into the active version. */
export async function upsertCustomField({
  tenantId,
  formVersionId,
  code,
  label,
  field_type,
  required = false,
  placeholder = null,
  help_text = null,
  options_json = [],
  validation_json = null,
  section = "General", // not stored yet; reserved for future use
}) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const q = `
      insert into custom_fields
        (tenant_id, form_version_id, code, label, field_type, placeholder, help_text,
         options_json, validation_json, order_index, is_required, is_active)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb,
         coalesce((select coalesce(max(order_index),0)+1 from custom_fields where tenant_id=$1 and form_version_id=$2),0),
         $10, true)
      on conflict (tenant_id, form_version_id, code)
      do update set
        label = excluded.label,
        field_type = excluded.field_type,
        placeholder = excluded.placeholder,
        help_text = excluded.help_text,
        options_json = excluded.options_json,
        validation_json = excluded.validation_json,
        is_required = excluded.is_required
      returning *;
    `;
    const { rows } = await client.query(q, [
      tenantId,
      formVersionId,
      code,
      label,
      field_type,
      placeholder,
      help_text,
      JSON.stringify(options_json || []),
      validation_json ? JSON.stringify(validation_json) : null,
      required,
    ]);
    return rows[0];
  } finally {
    client.release();
  }
}

/** Upsert values for a lead record. */
export async function upsertLeadCustomValues({
  tenantId,
  formVersionId,
  recordType = "lead",
  recordId,
  values, // [{ code, value }]
}) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);

    const { rows: fields } = await client.query(
      `
      select id, code, field_type
      from custom_fields
      where tenant_id = $1 and form_version_id = $2 and is_active = true;
      `,
      [tenantId, formVersionId]
    );
    const map = new Map(fields.map((f) => [f.code, f]));

    for (const { code, value } of values) {
      const f = map.get(code);
      if (!f) continue;

      let cols = { text: null, number: null, date: null, json: null, file: null };
      switch ((f.field_type || "").toLowerCase()) {
        case "number":
          cols.number = value === null || value === "" ? null : Number(value);
          break;
        case "date":
          cols.date = value ? new Date(value) : null;
          break;
        case "file":
          cols.file = value || null; // expects file_id uuid
          break;
        case "select":
        case "text":
        default:
          if (typeof value === "object" && value !== null) cols.json = value;
          else cols.text = value == null ? null : String(value);
          break;
      }

      await client.query(
        `
        insert into custom_field_values
          (tenant_id, form_version_id, field_id, record_type, record_id,
           value_text, value_number, value_date, value_json, file_id)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        on conflict (tenant_id, field_id, record_type, record_id)
        do update set
          form_version_id = excluded.form_version_id,
          value_text   = excluded.value_text,
          value_number = excluded.value_number,
          value_date   = excluded.value_date,
          value_json   = excluded.value_json,
          file_id      = excluded.file_id,
          updated_at   = now();
        `,
        [
          tenantId,
          formVersionId,
          f.id,
          recordType,
          recordId,
          cols.text,
          cols.number,
          cols.date,
          cols.json ? JSON.stringify(cols.json) : null,
          cols.file,
        ]
      );
    }
  } finally {
    client.release();
  }
}
