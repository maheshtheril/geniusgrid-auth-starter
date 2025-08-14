// Adjust this import if your pool is at src/db/index.js
import { pool } from "../db/pool.js";

/** Ensure current request has the tenant scope set for RLS */
async function setTenantScope(client, tenantId) {
  // Your RLS uses ensure_tenant_scope(), usually backed by app.tenant_id
  await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
}

/** Get (or create) the custom form + active version for Leads */
export async function getActiveLeadsFormVersionId(tenantId) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);

    // 1) ensure form (module_name + code)
    const formRes = await client.query(
      `
      INSERT INTO custom_forms (tenant_id, module_name, code, name)
      VALUES ($1, 'crm', 'leads', 'Leads Form')
      ON CONFLICT (tenant_id, module_name, code)
      DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
      `,
      [tenantId]
    );
    const formId = formRes.rows[0].id;

    // 2) find active version or create v1
    const verRes = await client.query(
      `
      WITH got AS (
        SELECT id FROM custom_form_versions
        WHERE tenant_id = $1 AND form_id = $2 AND status = 'active'
        ORDER BY version DESC LIMIT 1
      )
      SELECT id FROM got
      UNION ALL
      SELECT id FROM (
        INSERT INTO custom_form_versions (tenant_id, form_id, version, status)
        SELECT $1, $2, 1, 'active'
        WHERE NOT EXISTS (SELECT 1 FROM got)
        RETURNING id
      ) ins
      LIMIT 1;
      `,
      [tenantId, formId]
    );

    return verRes.rows[0].id;
  } finally {
    client.release();
  }
}

/** List fields by form version */
export async function listFieldsByFormVersion(tenantId, formVersionId) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const { rows } = await client.query(
      `
      SELECT id, code, label, field_type, placeholder, help_text,
             options_json, validation_json, order_index, is_required, is_active
      FROM custom_fields
      WHERE tenant_id = $1 AND form_version_id = $2 AND is_active = true
      ORDER BY order_index, label;
      `,
      [tenantId, formVersionId]
    );
    return rows;
  } finally {
    client.release();
  }
}

/** Upsert a field into the active version */
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
  section = "General",
}) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);
    const q = `
      INSERT INTO custom_fields
        (tenant_id, form_version_id, code, label, field_type, placeholder, help_text,
         options_json, validation_json, order_index, is_required, is_active)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, COALESCE(
           (SELECT COALESCE(MAX(order_index), 0) + 1 FROM custom_fields WHERE tenant_id=$1 AND form_version_id=$2), 0
         ), $10, true)
      ON CONFLICT (tenant_id, form_version_id, code)
      DO UPDATE SET
        label = EXCLUDED.label,
        field_type = EXCLUDED.field_type,
        placeholder = EXCLUDED.placeholder,
        help_text = EXCLUDED.help_text,
        options_json = EXCLUDED.options_json,
        validation_json = EXCLUDED.validation_json,
        is_required = EXCLUDED.is_required,
        updated_at = now()
      RETURNING *;
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

/** Upsert values for a specific record (lead) */
export async function upsertLeadCustomValues({
  tenantId,
  formVersionId,
  recordType = "lead",
  recordId,
  values, // [{code, value}]
}) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);

    // Load fields by code → id + type
    const { rows: fields } = await client.query(
      `
      SELECT id, code, field_type
      FROM custom_fields
      WHERE tenant_id = $1 AND form_version_id = $2 AND is_active = true;
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
          cols.file = value || null; // expect file_id (uuid) if you wire uploads
          break;
        case "select":
        case "text":
        default:
          if (typeof value === "object") cols.json = value;
          else cols.text = value == null ? null : String(value);
          break;
      }

      await client.query(
        `
        INSERT INTO custom_field_values
          (tenant_id, form_version_id, field_id, record_type, record_id,
           value_text, value_number, value_date, value_json, file_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        ON CONFLICT (tenant_id, field_id, record_type, record_id)
        DO UPDATE SET
          form_version_id = EXCLUDED.form_version_id,
          value_text   = EXCLUDED.value_text,
          value_number = EXCLUDED.value_number,
          value_date   = EXCLUDED.value_date,
          value_json   = EXCLUDED.value_json,
          file_id      = EXCLUDED.file_id,
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
