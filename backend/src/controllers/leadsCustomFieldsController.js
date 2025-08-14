// 📄 src/controllers/leadsCustomFieldsController.js
import {
  getActiveLeadsFormVersionId,   // create-if-missing (used for GET & POST)
  listFieldsByFormVersion,
  upsertCustomField,
  upsertLeadCustomValues,
  getTenantDebugInfo,
} from "../services/leadsCustomFieldsService.js";

const getTenantId = (req) =>
  req.session?.tenantId ||
  req.session?.tenant_id ||
  req.user?.tenant_id ||
  req.headers["x-tenant-id"] ||
  null;

// GET /api/leads/custom-fields  → returns { formVersionId, fields: [] }
export async function listFields(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "No tenant in session" });

  // Optional scope debug (no writes)
  if (req.query.__scope === "1") {
    try {
      const dbg = await getTenantDebugInfo(tenantId);
      return res.json({ tenantId, dbg });
    } catch (e) {
      return res.status(500).json({ message: "Scope check failed", error: e.message });
    }
  }

  try {
    // ensure form & active version exist, then list fields
    const formVersionId = await getActiveLeadsFormVersionId(tenantId);
    const fields = await listFieldsByFormVersion(tenantId, formVersionId);
    return res.json({ formVersionId, fields });
  } catch (e) {
    req.log?.error?.({ err: e }, "listFields error");
    return res.status(500).json({ message: "Failed to load custom fields" });
  }
}

// POST /api/leads/custom-fields  → create/upssert a field
export async function createField(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "No tenant in session" });

  try {
    const { label, key, type, required = false, section = "General", options = [] } = req.body;
    if (!label) return res.status(422).json({ message: "label required" });

    const code = (key || label)
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64);

    const formVersionId = await getActiveLeadsFormVersionId(tenantId);

    const field = await upsertCustomField({
      tenantId,
      formVersionId,
      code,
      label,
      field_type: type,
      required,
      options_json: Array.isArray(options) ? options : [],
      placeholder: null,
      help_text: null,
      validation_json: null,
      section,
    });

    return res.json(field);
  } catch (e) {
    req.log?.error?.({ err: e }, "createField error");
    return res.status(500).json({ message: "Failed to save custom field" });
  }
}

// POST /api/leads/:leadId/custom-field-values  → save values for a lead
export async function saveValuesForLead(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "No tenant in session" });

  try {
    const { leadId } = req.params;
    const { values } = req.body; // [{ code, value }...]

    if (!Array.isArray(values) || !values.length) {
      return res.status(422).json({ message: "values[] required" });
    }

    const formVersionId = await getActiveLeadsFormVersionId(tenantId);
    await upsertLeadCustomValues({
      tenantId,
      formVersionId,
      recordType: "lead",
      recordId: leadId,
      values,
    });

    return res.json({ ok: true });
  } catch (e) {
    req.log?.error?.({ err: e }, "saveValuesForLead error");
    return res.status(500).json({ message: "Failed to save values" });
  }
}

// Export both ways so your router works no matter how it imports
export default { listFields, createField, saveValuesForLead };
export { listFields, createField, saveValuesForLead };
