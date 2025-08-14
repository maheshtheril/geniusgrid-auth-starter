import express from "express";
import {
  listFields,
  createField,
  saveValuesForLead,
} from "../controllers/leadsCustomFieldsController.js";

const router = express.Router();

// GET active custom fields for Leads form
router.get("/leads/custom-fields", listFields);

// CREATE/UPSERT a custom field into active Leads form version
router.post("/leads/custom-fields", createField);

// UPSERT values for a lead (record_id = lead.id)
router.post("/leads/:leadId/custom-field-values", saveValuesForLead);

export default router;
