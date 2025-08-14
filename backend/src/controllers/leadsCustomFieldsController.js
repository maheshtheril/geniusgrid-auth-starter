// src/controllers/leadsCustomFieldsController.js
import { pool } from "../db/pool.js";

/* Set tenant scope (GUCs) on THIS connection */
async function setTenantScope(client, tenantId) {
  await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query("select set_config('request.jwt.claims.tenant_id', $1, true)", [tenantId]);
  await client.query("select set_config('request.tenant_id', $1, true)", [tenantId]);
}

/* Ensure form + active version */
async function ensureFormAndActiveVersion(client, tenantId) {
  await setTenantScope(client, tenantId);

  const form = await client.query(
    `insert into custom_forms (tenant_id, module_name, code, name)
     values ($1,'crm','leads','Leads Form')
     on conflict (tenant_id, module_name, code)
     do update set name = excluded.name
     returning id`,
    [tenantId]
  );
  const formId = form.rows[0].id;

  const got = await client.query(
    `select id from custom_form_versions
     where tenant_id=$1 and form_id=$2 and status='active'
     order by version desc limit 1`,
    [tenantId, formId]
  );
  if (got.rowCount) return got.rows[0].id;

  const ins = await client.query(
    `insert into custom_form_versions (tenant_id, form_id, version, status)
     values ($1,$2,1,'active')
     returning id`,
    [tenantId, formId]
  );
  return ins.rows[0].id;
}

/* GET /api/leads/custom-fields -> { formVersionId, fields: [...] } */
export async function listFields(req, res) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

  const client = await pool.connect();
  try {
    const formVersionId = await ensureFormAndActiveVersion(client, tenantId);
    const { rows } = await client.query(
      `select id, code, label, field_type, placeholder, help_text,
              options_json, validation_json, order_index, is_required, is_active
       from custom_fields
       where tenant_id=$1 and form_version_id=$2 and is_active=true
       order by order_index, label`,
      [tenantId, formVersionId]
    );

    // Optional debug: /api/leads/custom-fields?__dbg=1
    if (req.query.__dbg) {
      const dbg = await client.query(
        `select
           current_setting('app.tenant_id', true) as app_tenant_id,
           current_setting('request.jwt.claims.tenant_id', true) as jwt_tenant_id,
           current_setting('request.tenant_id', true) as req_tenant_id`
      );
      return res.json({ formVersionId, fields: rows, dbg: dbg.rows[0] });
    }

    res.json({ formVersionId, fields: rows });
  } catch (err) {
    req.log?.error({ err }, "listFields failed");
    res.status(500).json({ message: "Failed to load custom fields" });
  } finally {
    client.release();
  }
}

/* POST /api/leads/custom-fields -> upsert field */
export async function createField(req, res) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

  const { label, key, type, required = false, options = [] } = req.body || {};
  if (!label || !key || !type) {
    return res.status(400).json({ message: "label, key and type are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await setTenantScope(client, tenantId); // <-- critical for RLS

    const formVersionId = await ensureFormAndActiveVersion(client, tenantId);

    const oi = await client.query(
      `select coalesce(max(order_index),0)+1 as next
       from custom_fields where tenant_id=$1 and form_version_id=$2`,
      [tenantId, formVersionId]
    );
    const nextOrder = oi.rows[0].next;

    const up = await client.query(
      `insert into custom_fields
         (tenant_id, form_version_id, code, label, field_type,
          options_json, is_required, order_index, is_active)
       values
         ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,true)
       on conflict (tenant_id, form_version_id, code)
       do update set
         label        = excluded.label,
         field_type   = excluded.field_type,
         options_json = excluded.options_json,
         is_required  = excluded.is_required,
         is_active    = true
       returning id, code, label, field_type, options_json, is_required`,
      [tenantId, formVersionId, key, label, type, JSON.stringify(options || []), required, nextOrder]
    );

    await client.query("commit");
    res.json({ formVersionId, ...up.rows[0] });
  } catch (err) {
    await (async () => { try { await client.query("rollback"); } catch {} })();
    req.log?.error({ err }, "createField failed");
    res.status(500).json({ message: "Failed to save custom field" });
  } finally {
    client.release();
  }
}

/* POST /api/leads/:leadId/custom-field-values */
export async function saveValuesForLead(req, res) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

  const leadId = req.params.leadId;
  const valuesObj = req.body?.custom_fields || {};
  if (!leadId || typeof valuesObj !== "object") {
    return res.status(400).json({ message: "leadId and custom_fields required" });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await setTenantScope(client, tenantId); // <-- critical for RLS

    const formVersionId = await ensureFormAndActiveVersion(client, tenantId);

    const { rows: fields } = await client.query(
      `select id, code, field_type
       from custom_fields
       where tenant_id=$1 and form_version_id=$2 and is_active=true`,
      [tenantId, formVersionId]
    );
    const byCode = new Map(fields.map((f) => [f.code, f]));

    for (const [code, value] of Object.entries(valuesObj)) {
      const f = byCode.get(code);
      if (!f) continue;

      let t=null, n=null, d=null, j=null, file=null;
      switch ((f.field_type || "").toLowerCase()) {
        case "number": n = value === "" || value == null ? null : Number(value); break;
        case "date":   d = value ? new Date(value) : null; break;
        case "file":   file = value || null; break;
        case "select":
        case "text":
        default:
          if (value && typeof value === "object") j = value;
          else t = value == null ? null : String(value);
      }

      await client.query(
        `insert into custom_field_values
           (tenant_id, form_version_id, field_id, record_type, record_id,
            value_text, value_number, value_date, value_json, file_id)
         values
           ($1,$2,$3,'lead',$4,$5,$6,$7,$8::jsonb,$9)
         on conflict (tenant_id, field_id, record_type, record_id)
         do update set
           form_version_id = excluded.form_version_id,
           value_text   = excluded.value_text,
           value_number = excluded.value_number,
           value_date   = excluded.value_date,
           value_json   = excluded.value_json,
           file_id      = excluded.file_id,
           updated_at   = now()`,
        [
          tenantId, formVersionId, f.id, leadId,
          t, n, d, j ? JSON.stringify(j) : null, file
        ]
      );
    }

    await client.query("commit");
    res.json({ ok: true });
  } catch (err) {
    await (async () => { try { await client.query("rollback"); } catch {} })();
    req.log?.error({ err }, "saveValuesForLead failed");
    res.status(500).json({ message: "Failed to save custom field values" });
  } finally {
    client.release();
  }
}
