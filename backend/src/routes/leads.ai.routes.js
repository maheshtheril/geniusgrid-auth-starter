// src/routes/leads.ai.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { aiSummarizeAndSuggest, aiScoreLead } from "../services/ai.js";

const router = Router();

const OPENAI_MODEL = process.env.OPENAI_MODEL || null;

function tenantId(req) {
  return req.session?.tenantId || req.session?.tenant_id || null;
}
function actorId(req) {
  return req.session?.user?.id || req.session?.user_id || null;
}

async function getLeadOr404(req, res, id) {
  const { rows } = await pool.query(
    `select *
       from public.leads
      where id = $1
        and tenant_id = ensure_tenant_scope()
      limit 1`,
    [id]
  );
  const lead = rows[0];
  if (!lead) res.status(404).json({ message: "Lead not found" });
  return lead;
}

// GET latest AI artifacts for a lead (summary cache, newest first)
router.get("/:id/ai", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = await getLeadOr404(req, res, id);
    if (!lead) return;

    const { rows: cache } = await pool.query(
      `select kind, model, data, created_at
         from public.lead_ai_cache
        where tenant_id = ensure_tenant_scope()
          and lead_id = $1
        order by created_at desc
        limit 50`,
      [id]
    );

    // also surface what's currently stored on the lead row
    res.json({
      data: {
        lead_ai: {
          ai_summary: lead.ai_summary,
          ai_score: lead.ai_score,
          ai_next: lead.ai_next,
        },
        cache,
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST summarize + suggest next actions, persist on lead, cache, and log event
router.post("/:id/ai-refresh", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const histLimit = Math.max(
      0,
      Math.min(50, Number(req.query.history_limit ?? 10))
    );

    const lead = await getLeadOr404(req, res, id);
    if (!lead) return;

    // take a few recent events/notes if available for context
    const { rows: history } = await pool.query(
      `select event_type, payload, created_at
         from public.lead_events
        where tenant_id = ensure_tenant_scope()
          and lead_id = $1
        order by created_at desc
        limit ${histLimit}`,
      [id]
    );

    const { summary, next_actions, model } = await aiSummarizeAndSuggest(
      lead,
      history
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // cache raw result
      await client.query(
        `insert into public.lead_ai_cache
            (tenant_id, lead_id, kind, model, data)
         values (ensure_tenant_scope(), $1, 'summary', $2, $3::jsonb)`,
        [id, model || OPENAI_MODEL, JSON.stringify({ summary, next_actions })]
      );

      // update lead
      await client.query(
        `update public.leads
            set ai_summary = $1,
                ai_next    = $2::jsonb,
                updated_at = now()
          where id = $3
            and tenant_id = ensure_tenant_scope()`,
        [summary, JSON.stringify(next_actions || []), id]
      );

      // event log
      await client.query(
        `insert into public.lead_events
           (tenant_id, lead_id, event_type, payload, created_by_id)
         values (ensure_tenant_scope(), $1, 'ai_enriched', $2::jsonb, $3)`,
        [id, JSON.stringify({ summary_len: summary?.length || 0, next_actions }), actorId(req)]
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true, summary, next_actions });
  } catch (e) {
    next(e);
  }
});

// POST re-score lead, persist score/history, and log event
router.post("/:id/ai-score", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = await getLeadOr404(req, res, id);
    if (!lead) return;

    const { score, reasons, model } = await aiScoreLead(lead);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // append score history
      await client.query(
        `insert into public.lead_scores
           (tenant_id, lead_id, score, reasons)
         values (ensure_tenant_scope(), $1, $2, $3::jsonb)`,
        [id, score, JSON.stringify(reasons ?? null)]
      );

      // update lead current score
      await client.query(
        `update public.leads
            set ai_score = $1,
                updated_at = now()
          where id = $2
            and tenant_id = ensure_tenant_scope()`,
        [score, id]
      );

      // event log
      await client.query(
        `insert into public.lead_events
           (tenant_id, lead_id, event_type, payload, created_by_id)
         values (ensure_tenant_scope(), $1, 'ai_scored', $2::jsonb, $3)`,
        [id, JSON.stringify({ score, model: model || OPENAI_MODEL }), actorId(req)]
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true, score, reasons });
  } catch (e) {
    next(e);
  }
});

export default router;
