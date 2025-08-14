import {
  getActiveLeadsFormVersionId,
  listFieldsByFormVersion,
  upsertCustomField,
  upsertLeadCustomValues,
} from "../services/leadsCustomFieldsService.js";

function getTenantId(req) {
  // from session auth middleware
  return req.user?.tenant_id || req.session?.tenant_id || req.headers["x-tenant-id"];
}

export async function listFields(req, res) {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "No tenant" });

    const formVersionId = await getActiveLeadsFormVersionId(tenantId);
    const fields = await listFieldsByFormVersion(tenantId, formVersionId);
    return res.json({ formVersionId, fields });
  } catch (e) {
    console.error("listFields error", e);
    res.status(500).json({ message: "Failed to load custom fields" });
  }
}

export async function createField(req, res) {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "No tenant" });

    const { label, key, type, required = false, section = "General", options = [] } = req.body;
    if (!label) return res.status(422).json({ message: "label required" });

    const code = (key || label).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
    const field_type = type;

    const formVersionId = await getActiveLeadsFormVersionId(tenantId);
    const field = await upsertCustomField({
      tenantId,
      formVersionId,
      code,
      label,
      field_type,
      required,
      options_json: Array.isArray(options) ? options : [],
      // place-holders you can expand later:
      placeholder: null,
      help_text: null,
      validation_json: null,
      section,
    });

    return res.json(field);
  } catch (e) {
    console.error("createField error", e);
    res.status(500).json({ message: "Failed to save custom field" });
  }
}

export async function saveValuesForLead(req, res) {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "No tenant" });

    const { leadId } = req.params;
    const { values } = req.body; // [{ code:'pan_no', value:'ABCPX1234Q' }, ...]

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
    console.error("saveValuesForLead error", e);
    res.status(500).json({ message: "Failed to save values" });
  }
}
