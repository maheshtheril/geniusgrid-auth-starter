// src/routes/cfv.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ------------ helpers ------------ */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (x) => typeof x === "string" && UUID_RE.test(x);

function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}

async function setTenant(client, tenantId) {
  // NON-LOCAL so it persists on this connection (for ensure_tenant_scope() + RLS)
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* ------------ list custom fields (for the form) ------------ */
router.get("/fields", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const q = String(req.query.q || "").trim().toLowerCase();
    const params = [];
    let where = `tenant_id = ensure_tenant_scope()`;
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (LOWER(code) LIKE $1)`;
    }

    const { rows } = await client.query(
      `SELECT id, code, field_type, form_version_id
         FROM public.custom_fields
        WHERE ${where}
        ORDER BY COALESCE(code, '') ASC, id ASC
        LIMIT 200`,
      params
    );

    res.json(rows);
  } catch (e) {
    console.error("GET /api/cfv/fields error:", e);
    res.status(500).json({ error: "Failed to load fields" });
  } finally {
    client.release();
  }
});

/* ------------ create ONE CFV row ------------ */
router.post("/", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const {
    field_id,          // UUID (optional if code provided)
    code,              // string (optional if field_id provided)
    record_type,       // required (e.g., "lead")
    record_id,         // required UUID
    value_text,        // optional
    value_number,      // optional
    value_date,        // optional, e.g. "2025-08-22"
    value_json,        // optional (object/array/string)
    file_id = null,    // optional (UUID or null)
  } = req.body || {};

  if (!record_type || typeof record_type !== "string" || record_type.length > 64) {
    return res.status(400).json({ error: "record_type is required (<=64 chars)" });
  }
  if (!isUuid(String(record_id || ""))) {
    return res.status(400).json({ error: "record_id must be a UUID" });
  }
  if (!field_id && !code) {
    return res.status(400).json({ error: "Provide field_id (UUID) or code (string)" });
  }

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    // Resolve the field by id or code (scoped to tenant)
    let fieldRow = null;
    if (isUuid(String(field_id || ""))) {
      const { rows } = await client.query(
        `SELECT id, code, field_type, form_version_id
           FROM public.custom_fields
          WHERE tenant_id = ensure_tenant_scope()
            AND id = $1
          LIMIT 1`,
        [field_id]
      );
      fieldRow = rows[0] || null;
    } else if (code) {
      const { rows } = await client.query(
        `SELECT id, code, field_type, form_version_id
           FROM public.custom_fields
          WHERE tenant_id = ensure_tenant_scope()
            AND LOWER(code) = LOWER($1)
          LIMIT 1`,
        [String(code)]
      );
      fieldRow = rows[0] || null;
    }

    if (!fieldRow) {
      return res.status(400).json({ error: "No matching custom_field for given field_id/code" });
    }
    if (!fieldRow.form_version_id) {
      return res.status(400).json({ error: "custom_field has no form_version_id" });
    }

    // Coerce value based on field_type
    let vText = value_text ?? null;
    let vNum  = value_number ?? null;
    let vDate = value_date ?? null;
    let vJson = value_json ?? null;

    const ft = String(fieldRow.field_type || "").toLowerCase().trim();

    switch (ft) {
      case "number":
      case "int":
      case "integer":
      case "float":
      case "decimal":
      case "currency": {
        const n = Number(vNum);
        vNum = Number.isFinite(n) ? n : null;
        vText = null; vDate = null; vJson = null;
        break;
      }
      case "date":
      case "dob":
      case "birthday": {
        vDate = vDate ? String(vDate).slice(0, 10) : null;
        vText = null; vNum = null; vJson = null;
        break;
      }
      case "json":
      case "object":
      case "array": {
        if (vJson == null && vText != null) {
          try { vJson = JSON.parse(vText); } catch { vJson = vText; }
          vText = null;
        }
        vNum = null; vDate = null;
        break;
      }
      case "multiselect":
      case "multi_select":
      case "checkboxes":
      case "tags": {
        // store as JSON array
        if (!Array.isArray(vJson)) {
          if (Array.isArray(vText)) vJson = vText;
          else if (typeof vText === "string") {
            vJson = vText.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
          } else {
            vJson = vJson ?? [];
          }
        }
        vText = null; vNum = null; vDate = null;
        break;
      }
      default: {
        // text/select/radio/email/phone → value_text
        if (vText != null) vText = String(vText);
        vNum = null; vDate = null; // keep vJson only if explicitly provided
        break;
      }
    }

    // Insert
    const insertSQL = `
      INSERT INTO public.custom_field_values
        (tenant_id, form_version_id, field_id, record_type, record_id,
         value_text, value_number, value_date, value_json, file_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, tenant_id, form_version_id, field_id, record_type, record_id,
                value_text, value_number, value_date, value_json, file_id,
                created_at, updated_at
    `;
    const params = [
      tenantId,
      fieldRow.form_version_id,
      fieldRow.id,
      record_type,
      record_id,
      vText,
      vNum,
      vDate,
      vJson,
      isUuid(String(file_id || "")) ? file_id : null,
    ];

    const { rows } = await client.query(insertSQL, params);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /api/cfv error:", {
      message: err?.message, code: err?.code, detail: err?.detail,
    });
    switch (err?.code) {
      case "22P02": return res.status(400).json({ error: "Invalid UUID in request" });
      case "23503": return res.status(400).json({ error: "Invalid reference (field or record not found)" });
      case "23502": return res.status(400).json({ error: `Missing required column: ${err.column}` });
      default:      return res.status(500).json({ error: "Failed to insert CFV" });
    }
  } finally {
    client.release();
  }
});

export default router;
