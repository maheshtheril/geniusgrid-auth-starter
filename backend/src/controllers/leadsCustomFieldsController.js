import {
  getActiveLeadsFormVersionId,
  listFieldsByFormVersion,
  upsertCustomField,
  upsertLeadCustomValues,
  getTenantDebugInfo,
} from "../services/leadsCustomFieldsService.js";

function getTenantId(req) {
  // prefer session.tenantId (your code sets this), then user.tenant_id, then header.
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.user?.tenant_id ||
    req.headers["x-tenant-id"]
  );
}

export async function listFields(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "No tenant in session" });

  try {
    const formVersionId = await getActiveLeadsFormVersionId(tenantId);
    const fields = await listFieldsByFormVersion(tenantId, formVersionId);

    // debug helper: append current GUC values when ?__dbg=1
    if (req.query.__dbg === "1") {
      const dbg = await getTenantDebugInfo(tenantId);
      return res.json({ formVersionId, fields, dbg });
    }
    return res.json({ formVersionId, fields });
  } catch (e) {
    req.log?.error({ err: e }, "listFields error");
    return res.status(500).json({ message: "Failed to load custom fields" });
  }
}

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
    req.log?.error({ err: e }, "createField error");
    return res.status(500).json({ message: "Failed to save custom field" });
  }
}

export async function saveValuesForLead(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "No tenant in session" });

  try {
    const { leadId } = req.params;
    const { values } = req.body; // [{ code, value }, ...]

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
    req.log?.error({ err: e }, "saveValuesForLead error");
    return res.status(500).json({ message: "Failed to save values" });
  }
}
