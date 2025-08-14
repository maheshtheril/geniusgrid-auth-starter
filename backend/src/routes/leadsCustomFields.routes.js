// 📄 src/routes/leadsCustomFields.routes.js
import express from "express";
import * as mod from "../controllers/leadsCustomFieldsController.js";

const router = express.Router();

// Resolve handlers from either named or default exports
const listFields        = mod.listFields        ?? mod.default?.listFields;
const createField       = mod.createField       ?? mod.default?.createField;
const saveValuesForLead = mod.saveValuesForLead ?? mod.default?.saveValuesForLead;

// Fail early with a readable message if something's missing
if (typeof listFields !== "function" ||
    typeof createField !== "function" ||
    typeof saveValuesForLead !== "function") {
  console.error("leadsCustomFieldsController exports:", Object.keys(mod));
  throw new Error("Missing handlers: listFields, createField, saveValuesForLead");
}

// GET active custom fields for Leads form
router.get("/leads/custom-fields", listFields);

// CREATE/UPSERT a custom field into active Leads form version
router.post("/leads/custom-fields", createField);

// UPSERT values for a lead (record_id = lead.id)
router.post("/leads/:leadId/custom-field-values", saveValuesForLead);

export default router;
