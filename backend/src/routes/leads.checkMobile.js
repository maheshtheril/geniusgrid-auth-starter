// src/routes/leads.checkMobile.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// POST /api/leads/check-mobile  { mobile: "+1 555 0101" }
router.post("/leads/check-mobile", requireAuth, async (req, res) => {
  try {
    const raw = String(req.body?.mobile || "");
    const digits = raw.replace(/[^0-9]/g, ""); // same as trigger
    if (!digits) return res.json({ exists: false });

    // tenant is already set on the connection by your set_config hook
    const q = `
      SELECT 1
      FROM public.leads
      WHERE tenant_id = ensure_tenant_scope()
        AND phone_norm = $1
      LIMIT 1
    `;
    const r = await pool.query(q, [digits]);
    res.json({ exists: r.rowCount > 0 });
  } catch (e) {
    req.log?.error({ err: e }, "check-mobile failed");
    res.status(500).json({ exists: false });
  }
});

export default router;
