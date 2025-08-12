// src/routes/leads.assign.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/:id/assign", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { owner_id, reason } = req.body || {};
    if (!owner_id) return res.status(400).json({ message: "owner_id is required" });

    // ensure the lead exists
    const { rows } = await pool.query(
      `select id from public.leads where id=$1 and tenant_id=ensure_tenant_scope()`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ message: "Lead not found" });

    // insert assignment trail
    await pool.query(
      `insert into public.lead_assignments (tenant_id, lead_id, owner_id, assigned_by, reason)
       values (ensure_tenant_scope(), $1, $2, $3, $4)`,
      [id, owner_id, req.user?.id || null, reason || null]
    );

    // mirror on lead row
    await pool.query(
      `update public.leads
          set owner_id = $1,
              updated_at = now()
        where id = $2 and tenant_id = ensure_tenant_scope()`,
      [owner_id, id]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
