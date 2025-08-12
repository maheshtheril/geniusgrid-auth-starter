// src/routes/leads.merge.routes.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/**
 * POST /api/leads/merge
 * body: { primary_id, duplicate_id, strategy? }
 * - strategy.mergeJson: "deep" | "primary" | "duplicate"
 * - strategy.keep: array of field names to always keep from primary
 */
router.post("/merge", requireAuth, async (req, res, next) => {
  const { primary_id, duplicate_id, strategy = {} } = req.body || {};
  if (!primary_id || !duplicate_id || primary_id === duplicate_id) {
    return res.status(400).json({ message: "primary_id and duplicate_id required and must differ" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // both leads must exist in this tenant
    const { rows: leads } = await client.query(
      `select *
         from public.leads
        where id in ($1,$2) and tenant_id = ensure_tenant_scope()
        order by case when id = $1 then 0 else 1 end`,
      [primary_id, duplicate_id]
    );
    if (leads.length !== 2) {
      throw new Error("One or both leads not found in tenant");
    }
    const primary = leads[0].id === primary_id ? leads[0] : leads[1];
    const duplicate = leads[0].id === duplicate_id ? leads[0] : leads[1];

    // merge policy: prefer primary; fill primary blanks from duplicate
    const keep = new Set(strategy.keep || []);
    const merged = { ...primary };

    const fill = (k) => {
      if (keep.has(k)) return;
      const pv = primary[k];
      const dv = duplicate[k];
      if ((pv === null || pv === "" || pv === undefined) && dv != null && dv !== "") {
        merged[k] = dv;
      }
    };

    // common scalar fields to backfill
    ["company","email","phone","website","stage","status","owner","owner_id","next_action","priority","followup_at"]
      .forEach(fill);

    // combine helpful text
    const combineText = (...parts) =>
      parts.filter(Boolean).map(s => String(s)).join("\n").trim();

    merged.ai_summary = combineText(primary.ai_summary, duplicate.ai_summary);

    // merge ai_next array (dedupe by action text)
    function normActions(a = []) {
      return (Array.isArray(a) ? a : []).map(x => ({
        action: x.action || x.task || "",
        why: x.why || x.reason || "",
        priority: Number(x.priority ?? 2)
      })).filter(x => x.action);
    }
    const nextCombined = [
      ...normActions(primary.ai_next),
      ...normActions(duplicate.ai_next)
    ];
    const seen = new Set();
    merged.ai_next = nextCombined.filter(x => {
      const key = x.action.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // numeric score: keep max
    merged.ai_score = Math.max(Number(primary.ai_score || 0), Number(duplicate.ai_score || 0)) || null;

    // custom JSON: deep merge (default), or pick side
    const jsonMergeMode = (strategy.mergeJson || "deep").toLowerCase();
    const pCustom = primary.custom || {};
    const dCustom = duplicate.custom || {};
    let mergedCustom = pCustom;
    if (jsonMergeMode === "duplicate") mergedCustom = dCustom;
    if (jsonMergeMode === "deep") {
      mergedCustom = { ...pCustom, ...dCustom };
    }
    merged.custom = mergedCustom;

    // write back merged primary
    await client.query(
      `update public.leads set
          company = $2, email = $3, phone = $4, website = $5,
          stage = $6, status = $7, owner = $8, owner_id = $9,
          next_action = $10, priority = $11, followup_at = $12,
          ai_summary = $13, ai_next = $14, ai_score = $15, custom = $16,
          updated_at = now()
        where id = $1 and tenant_id = ensure_tenant_scope()`,
      [
        primary_id,
        merged.company, merged.email, merged.phone, merged.website,
        merged.stage, merged.status, merged.owner, merged.owner_id,
        merged.next_action, merged.priority, merged.followup_at,
        merged.ai_summary, JSON.stringify(merged.ai_next || []), merged.ai_score, merged.custom
      ]
    );

    // re-home child rows
    const moveTables = [
      ["public.lead_events", "lead_id"],
      ["public.lead_assignments", "lead_id"],
      ["public.lead_ai_cache", "lead_id"],
      ["public.lead_scores", "lead_id"]
    ];
    for (const [tbl, col] of moveTables) {
      await client.query(
        `update ${tbl} set ${col} = $1
          where ${col} = $2 and tenant_id = ensure_tenant_scope()`,
        [primary_id, duplicate_id]
      );
    }

    // lead_duplicates: easiest is to remove any rows touching duplicate
    await client.query(
      `delete from public.lead_duplicates
        where tenant_id = ensure_tenant_scope()
          and (lead_id = $1 or dup_lead_id = $1)`,
      [duplicate_id]
    );

    // add an event on primary describing merge
    await client.query(
      `insert into public.lead_events (tenant_id, lead_id, event_type, payload)
       values (ensure_tenant_scope(), $1, 'merged', $2)`,
      [primary_id, { merged_from: duplicate_id, by: req.user?.id || null }]
    );

    // finally, delete duplicate
    await client.query(
      `delete from public.leads
        where id = $1 and tenant_id = ensure_tenant_scope()`,
      [duplicate_id]
    );

    await client.query("COMMIT");

    const { rows: refreshed } = await pool.query(
      `select * from public.leads
        where id = $1 and tenant_id = ensure_tenant_scope()`,
      [primary_id]
    );
    res.json({ ok: true, lead: refreshed[0] });
  } catch (e) {
    try { await pool.query("ROLLBACK"); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

export default router;
