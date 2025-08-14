// src/routes/leadsCustomFields.routes.js
import express from "express";
import { listFields, createField, saveValuesForLead } from "../controllers/leadsCustomFieldsController.js";

const router = express.Router();

router.get("/leads/custom-fields", listFields);          // list active fields
router.post("/leads/custom-fields", createField);        // create/upsert field
router.post("/leads/:leadId/custom-field-values", saveValuesForLead); // save values for a lead

export default router;
