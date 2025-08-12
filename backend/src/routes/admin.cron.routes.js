// src/routes/admin.cron.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { aiScoreLead } from "../services/ai.js";

const router = Router();
const KEY = process.env.CRON_KEY || ""; // set in env

// GET /api/admin/cron/ai-rescore?staleHours=72&limit=200
router.get("/ai-rescore", async (req, res, next) => {
  try {
    const hdr = req.get("X-Cron-Key") || "";
    if (!KEY || hdr !== KEY) return res.status(401).json({ message: "unauthorized" });

    const staleHours = Number(req.query.staleHours || 72);
    const limit = Math.min(Number(req.query.limit || 200), 1000);

    // iterate tenants
    const { rows: tenants } = await pool.query(`select distinct tenant_id from public.leads`);
    let processed = 0;

    for (const t of tenants) {
      // set tenant scope for this connection
      await pool.query(`select set_config('app.tenant_id', $1, false)`, [t.tenant_id]);

      const { rows: batch } = await pool.query(
        `select id, name, company, email, phone, stage, status, custom, ai_score
           from public.leads
          where tenant_id = ensure_tenant_scope()
            and (ai_score is null or updated_at < now() - ($1 || ' hours')::interval)
          order by updated_at asc
          limit $2`,
        [staleHours, limit]
      );

      for (const lead of batch) {
        const { score, reasons } = await aiScoreLead(lead);
        await pool.query(
          `insert into public.lead_scores (tenant_id, lead_id, score, reasons)
           values (ensure_tenant_scope(), $1, $2, $3)`,
          [lead.id, score, reasons]
        );
        await pool.query(
          `update public.leads
              set ai_score = $1, updated_at = now()
            where id = $2 and tenant_id = ensure_tenant_scope()`,
          [score, lead.id]
        );
        processed++;
      }
    }

    res.json({ ok: true, processed, tenants: tenants.length });
  } catch (e) {
    next(e);
  }
});

export default router;
