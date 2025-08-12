// src/services/leadsAi.service.js
import { pool } from "../db/pool.js";
import OpenAI from "openai";

/**
 * Fetch a lead (tenant-scoped) with a small data pack for prompting
 */
async function fetchLead(tenantId, leadId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, phone, company, source, stage, profession, details, created_at
       FROM public.leads
      WHERE id = $1 AND tenant_id = ensure_tenant_scope()
      LIMIT 1`,
    [leadId]
  );
  return rows[0] || null;
}

/**
 * Best-effort JSON parse
 */
function safeParseJson(txt) {
  try { return JSON.parse(txt); } catch { return null; }
}

/**
 * Heuristic fallback when no OPENAI_API_KEY present.
 */
function heuristicEnrich(lead) {
  const next = [];
  if (lead.email) next.push({ title: "Send intro email", due_in_days: 1 });
  if (lead.phone) next.push({ title: "Schedule call", due_in_days: 2 });
  const score = Math.min(95, (lead.company ? 70 : 50) + (lead.email ? 10 : 0) + (lead.phone ? 15 : 0));
  const summary = `Lead ${lead.name || "(unknown)"}${lead.company ? ` at ${lead.company}` : ""}. Source:${lead.source || "n/a"}. Stage:${lead.stage || "n/a"}.`;
  return { summary, score, next_actions: next.length ? next : [{ title: "Research lead", due_in_days: 3 }] };
}

/**
 * Call OpenAI to generate summary/score/next actions.
 */
async function callOpenAI(lead) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristicEnrich(lead);

  const client = new OpenAI({ apiKey });

  const sys = `You are a CRM assistant. Return STRICT JSON with keys:
{
  "summary": string,       // one paragraph summary of the lead
  "score": number,         // 0..100 probability-of-conversion (integer OK)
  "next_actions": [        // 1-3 immediate, concrete actions
    {"title": string, "due_in_days": number}
  ]
}
No markdown. No extra keys.`;

  const usr = {
    lead: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      source: lead.source,
      stage: lead.stage,
      profession: lead.profession,
      details: lead.details
    }
  };

  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: JSON.stringify(usr) }
    ],
    response_format: { type: "json_object" }
  });

  const txt = resp.choices?.[0]?.message?.content?.trim() || "";
  const json = safeParseJson(txt);
  if (!json) return heuristicEnrich(lead);

  const score = Number.isFinite(json.score) ? Math.max(0, Math.min(100, Math.round(json.score))) : 60;
  const next_actions = Array.isArray(json.next_actions) ? json.next_actions.slice(0, 3) : heuristicEnrich(lead).next_actions;
  const summary = String(json.summary || "").slice(0, 1200);

  return { summary, score, next_actions };
}

/**
 * Enrich a single lead and persist results.
 */
export async function aiEnrichLead({ tenantId, leadId, actorUserId = null }) {
  const lead = await fetchLead(tenantId, leadId);
  if (!lead) throw new Error("Lead not found");

  const { summary, score, next_actions } = await callOpenAI(lead);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.leads
          SET ai_summary = $2,
              ai_score   = $3,
              ai_next    = $4::jsonb,
              ai_next_action = COALESCE($4::jsonb->0->>'title', ai_next_action),
              updated_at = now()
        WHERE id = $1 AND tenant_id = ensure_tenant_scope()`,
      [leadId, summary, score, JSON.stringify(next_actions)]
    );

    await client.query(
      `INSERT INTO public.lead_events(tenant_id, lead_id, event_type, payload, created_by_id)
       VALUES (ensure_tenant_scope(), $1, 'ai_enriched', $2::jsonb, $3)`,
      [leadId, { score, next_actions }, actorUserId]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return { leadId, summary, score, next_actions };
}

/**
 * Fire-and-forget queue (very lightweight).
 * If you prefer a real queue, you can plug Bull/Redis here later.
 */
export function queueAiEnrichment({ tenantId, leadId, actorUserId }) {
  // decouple from request lifecycle
  setImmediate(async () => {
    try { await aiEnrichLead({ tenantId, leadId, actorUserId }); }
    catch (e) { /* log if you want */ }
  });
}
