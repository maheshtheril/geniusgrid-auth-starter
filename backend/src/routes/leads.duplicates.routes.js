// src/routes/leads.duplicates.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Find likely duplicates for a given lead (pg_trgm + phone_norm/email/name)
router.get("/:id/duplicates", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows: baseRows } = await pool.query(
      `select id, name, email, phone_norm
         from public.leads
        where id = $1 and tenant_id = ensure_tenant_scope()`,
      [id]
    );
    const base = baseRows[0];
    if (!base) return res.status(404).json({ message: "Lead not found" });

    const { rows } = await pool.query(
      `
      with cand as (
        select l.id, l.name, l.email, l.phone_norm,
               greatest(
                 case when $2 is not null and l.phone_norm = $2 then 1.0 else 0 end,
                 case when $3 is not null and l.email is not null
                      then similarity(lower(l.email), lower($3)) else 0 end,
                 case when $4 is not null and l.name  is not null
                      then similarity(lower(l.name), lower($4)) else 0 end
               ) as sim
          from public.leads l
         where l.tenant_id = ensure_tenant_scope()
           and l.id <> $1
      )
      select id, name, email, phone_norm, sim
        from cand
       where sim >= ($5::numeric)
       order by sim desc
       limit 25;
      `,
      [id, base.phone_norm, base.email, base.name, Number(req.query.min || 0.45)]
    );

    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

// Resolve/mark a pair (open | merged | dismissed)
router.post("/duplicates/resolve", requireAuth, async (req, res, next) => {
  try {
    const { lead_id, dup_lead_id, disposition = "dismissed", similarity = 0 } = req.body || {};
    if (!lead_id || !dup_lead_id) return res.status(400).json({ message: "Missing ids" });

    await pool.query(
      `insert into public.lead_duplicates
         (tenant_id, lead_id, dup_lead_id, similarity, disposition)
       values (ensure_tenant_scope(), $1, $2, $3, $4)
       on conflict (tenant_id,
                    least(lead_id, dup_lead_id),
                    greatest(lead_id, dup_lead_id))
       do update set similarity = excluded.similarity,
                     disposition = excluded.disposition`,
      [lead_id, dup_lead_id, similarity, disposition]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
