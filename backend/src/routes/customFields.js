// src/routes/customFields.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ---------------- helpers ---------------- */
function getTenantId(req) {
  return (
    req.ctx?.tenantId ||
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}

function normalizeOptions(options_json) {
  if (Array.isArray(options_json)) return options_json;
  if (options_json && typeof options_json === "object") {
    if (Array.isArray(options_json.options)) return options_json.options;
    if (Array.isArray(options_json.choices)) return options_json.choices;
  }
  return [];
}

/* ---------------- GET /api/custom-fields ---------------- */
/**
 * Accepts: ?record_type=lead OR ?entity=lead (alias)
 * Optional: ?module=crm (default 'crm')
 * Reads tenant from session/ctx or x-tenant-id/tenant_id.
 * Returns a plain array the FE can consume.
 */
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

  const recordType = String(req.query.record_type || req.query.entity || "")
    .trim()
    .toLowerCase();
  if (!recordType) return res.status(400).json({ error: "record_type is required" });

  const moduleName = String(req.query.module || "crm");

  try {
    // 1) active form version for this tenant + recordType
    const vsql = `
      SELECT v.id AS form_version_id
      FROM public.custom_forms f
      JOIN public.custom_form_versions v
        ON v.form_id = f.id AND v.tenant_id = f.tenant_id
      WHERE f.tenant_id = $1
        AND f.module_name = $2
        AND f.code = $3
        AND v.status = 'active'
        AND (v.effective_to IS NULL OR v.effective_to > now())
      ORDER BY v.version DESC
      LIMIT 1;
    `;
    const vres = await pool.query(vsql, [tenantId, moduleName, recordType]);

    if (!vres.rowCount) {
      // no form configured yet → FE will show "No custom fields yet."
      return res.json([]);
    }

    // 2) fields for that version
    const fsql = `
      SELECT id, code, label, field_type, placeholder, help_text,
             COALESCE(options_json,'[]'::jsonb)    AS options_json,
             COALESCE(validation_json,'{}'::jsonb) AS validation_json,
             order_index, is_required, is_active
      FROM public.custom_fields
      WHERE tenant_id = $1
        AND form_version_id = $2
        AND is_active = true
      /* IMPORTANT: your table has no created_at, so don't sort by it */
      ORDER BY order_index NULLS LAST, label;
    `;
    const { rows } = await pool.query(fsql, [tenantId, vres.rows[0].form_version_id]);

    // 3) shape
    const shaped = rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      field_type: r.field_type,
      is_required: !!r.is_required,
      order_index: r.order_index ?? 0,
      options_json: normalizeOptions(r.options_json),
      validation_json: r.validation_json || {},
      is_active: r.is_active !== false,
      placeholder: r.placeholder || null,
      help_text: r.help_text || null,
    }));

    return res.json(shaped);
  } catch (err) {
    req.log?.error({ err }, "GET /api/custom-fields failed");
    // keep the same external message your logs hinted at
    return res.status(500).json({ message: "Failed to load custom fields" });
  }
});

/* ---------------- POST /api/custom-fields ---------------- */
router.post("/", async (req, res) => {
  try {
    const {
      record_type, label, code, field_type,
      placeholder = null, help_text = null,
      options_json = [], validation_json = {},
      is_required = false, is_active = true,
      module = "crm",
    } = req.body || {};

    if (!record_type || !label || !code || !field_type) {
      return res
        .status(400)
        .json({ error: "record_type, label, code, field_type are required" });
    }

    const tenantId = getTenantId(req);
    const userId = req.ctx?.userId || req.session?.userId || null;
    if (!tenantId || !userId) return res.status(401).json({ message: "Unauthorized" });

    const client = await pool.connect();
    try {
      await client.query(`SELECT set_config('app.tenant_id',$1,true)`, [String(tenantId)]);
      await client.query("BEGIN");

      // ensure form
      const { rows: formRows } = await client.query(
        `SELECT id FROM public.custom_forms
          WHERE tenant_id=$1 AND module_name=$2 AND code=$3
          LIMIT 1`,
        [tenantId, String(module), String(record_type).toLowerCase()]
      );
      let formId = formRows[0]?.id;
      if (!formId) {
        const ins = await client.query(
          `INSERT INTO public.custom_forms
             (tenant_id, module_name, code, name, is_active)
           VALUES ($1,$2,$3, initcap($3)||' Form', true)
           RETURNING id`,
          [tenantId, String(module), String(record_type).toLowerCase()]
        );
        formId = ins.rows[0].id;
      }

      // ensure active version
      const { rows: vrows } = await client.query(
        `SELECT id FROM public.custom_form_versions
          WHERE tenant_id=$1 AND form_id=$2
            AND status='active' AND effective_to IS NULL
          ORDER BY version DESC
          LIMIT 1`,
        [tenantId, formId]
      );
      let formVersionId = vrows[0]?.id;
      if (!formVersionId) {
        const vi = await client.query(
          `INSERT INTO public.custom_form_versions
             (tenant_id, form_id, version, status, effective_from)
           VALUES ($1,$2,1,'active', now())
           RETURNING id`,
          [tenantId, formId]
        );
        formVersionId = vi.rows[0].id;
      }

      // next order
      const { rows: ord } = await client.query(
        `SELECT COALESCE(MAX(order_index), 0)+1 AS next_order
           FROM public.custom_fields
          WHERE tenant_id=$1 AND form_version_id=$2`,
        [tenantId, formVersionId]
      );
      const nextOrder = Number(ord[0]?.next_order || 1);

      // insert
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
          tenantId,
          formVersionId,
          String(code).trim(),
          String(label).trim(),
          String(field_type).trim(),
          placeholder,
          help_text,
          Array.isArray(options_json) ? options_json : normalizeOptions(options_json),
          validation_json && typeof validation_json === "object" ? validation_json : {},
          nextOrder,
          !!is_required,
          !!is_active,
        ]
      );

      await client.query("COMMIT");
      const r = rows[0];
      r.options_json = normalizeOptions(r.options_json);
      return res.status(201).json(r);
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      if (e?.code === "23505") {
        return res.status(409).json({ error: "Field already exists", detail: e.detail || null });
      }
      req.log?.error({ err: e }, "POST /api/custom-fields failed");
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  } catch (err) {
    req.log?.error({ err }, "POST /api/custom-fields outer failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- PUT /api/custom-fields/:id ---------------- */
router.put("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const {
      label, code, field_type,
      placeholder, help_text,
      options_json, validation_json,
      is_required, is_active,
    } = req.body || {};

    const sets = [];
    const vals = [];
    const add = (col, val) => { sets.push(`${col} = $${vals.length + 1}`); vals.push(val); };

    if (label !== undefined)        add("label", label);
    if (code !== undefined)         add("code", code);
    if (field_type !== undefined)   add("field_type", field_type);
    if (placeholder !== undefined)  add("placeholder", placeholder);
    if (help_text !== undefined)    add("help_text", help_text);
    if (options_json !== undefined) add("options_json", Array.isArray(options_json) ? options_json : normalizeOptions(options_json));
    if (validation_json !== undefined) add("validation_json", validation_json && typeof validation_json === "object" ? validation_json : {});
    if (is_required !== undefined)  add("is_required", !!is_required);
    if (is_active !== undefined)    add("is_active", !!is_active);

    if (!sets.length) return res.json({ ok: true });

    vals.push(tenantId, id);

    const { rows } = await pool.query(
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

    const r = rows[0];
    r.options_json = normalizeOptions(r.options_json);
    return res.json(r);
  } catch (err) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Field already exists", detail: err.detail || null });
    }
    req.log?.error({ err }, "PUT /api/custom-fields/:id failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- DELETE /api/custom-fields/:id ---------------- */
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    await pool.query(
      `DELETE FROM public.custom_field_values WHERE tenant_id=$1 AND field_id=$2`,
      [tenantId, id]
    );
    const r = await pool.query(
      `DELETE FROM public.custom_fields WHERE tenant_id=$1 AND id=$2`,
      [tenantId, id]
    );

    if (!r.rowCount) return res.status(404).json({ error: "Field not found" });
    return res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "DELETE /api/custom-fields/:id failed");
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- PUT /api/custom-fields/reorder ---------------- */
router.put("/reorder", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const { record_type, order } = req.body || {};
    if (!record_type || !Array.isArray(order)) {
      return res.status(400).json({ error: "record_type and order[] required" });
    }

    const vsql = `
      SELECT v.id AS form_version_id
      FROM public.custom_forms f
      JOIN public.custom_form_versions v
        ON v.form_id = f.id AND v.tenant_id = f.tenant_id
      WHERE f.tenant_id = $1
        AND f.module_name = 'crm'
        AND f.code = $2
        AND v.status = 'active'
        AND v.effective_to IS NULL
      ORDER BY v.version DESC
      LIMIT 1;
    `;
    const vres = await pool.query(vsql, [tenantId, String(record_type).toLowerCase()]);
    if (!vres.rowCount) return res.status(404).json({ error: "Active form version not found" });

    await pool.query(
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
      [JSON.stringify(order), tenantId, vres.rows[0].form_version_id]
    );

    return res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "PUT /api/custom-fields/reorder failed");
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
