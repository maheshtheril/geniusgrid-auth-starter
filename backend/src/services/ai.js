// src/services/ai.js
import OpenAI from "openai";

/**
 * AI service for Leads:
 * - aiSummarizeAndSuggest(lead, history?)
 * - aiScoreLead(lead)
 *
 * Env (backend):
 *   OPENAI_API_KEY=...            // optional; falls back to heuristics if missing
 *   OPENAI_MODEL=gpt-4o-mini      // optional
 *   AI_TIMEOUT_MS=15000           // optional
 */

const hasKey = !!(process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim());
const client = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15000);

/* ------------------------------ utils ------------------------------ */

function fallbackSummary(lead, history = []) {
  const lastNote =
    history?.find?.((h) => h?.payload?.note)?.payload?.note ||
    history?.[0]?.payload?.note ||
    "";

  const lines = [
    `Lead: ${lead?.name || "Unknown"}`,
    lead?.company ? `Company: ${lead.company}` : null,
    lead?.email ? `Email: ${lead.email}` : null,
    lead?.phone ? `Phone: ${lead.phone}` : null,
    lastNote ? `Last note: ${lastNote}` : null,
    `Status: ${lead?.status || "new"}; Stage: ${lead?.stage || "new"}`,
  ].filter(Boolean);

  return {
    summary: lines.join("\n"),
    next_actions: [
      { action: "Call the lead", why: "Confirm interest and timing", priority: 1 },
      { action: "Send intro email", why: "Share value prop & case study", priority: 2 },
    ],
  };
}

function clampScore(n) {
  const x = Number.isFinite(n) ? n : 50;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function coerceActions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => ({
      action: String(a?.action ?? "").trim(),
      why: String(a?.why ?? "").trim(),
      priority: Number.isFinite(a?.priority) ? a.priority : 3,
    }))
    .filter((a) => a.action);
}

function safeParseJSON(s, fallback = {}) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`AI request timed out after ${ms} ms`));
      }, ms);
    }),
  ]);
}

async function withRetry(fn, { retries = 1, delay = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/* --------------------------- public methods --------------------------- */

/**
 * Summarize a lead and propose next actions.
 * Falls back to heuristic output when no key / on failure.
 */
export async function aiSummarizeAndSuggest(lead, history = []) {
  if (!client) return fallbackSummary(lead, history);

  const messages = [
    {
      role: "system",
      content:
        "You are a CRM sales assistant. Respond ONLY with JSON: " +
        `{"summary": string, "next_actions": [{"action": string, "why": string, "priority": 1|2|3|4|5}...]}. ` +
        "Be concise and actionable. No prose outside JSON.",
    },
    {
      role: "user",
      content: JSON.stringify({
        lead: {
          name: lead?.name ?? null,
          company: lead?.company ?? lead?.company_name ?? null,
          email: lead?.email ?? null,
          phone: lead?.phone ?? lead?.phone_norm ?? null,
          stage: lead?.stage ?? null,
          status: lead?.status ?? null,
          custom: lead?.custom ?? null,
        },
        recent_history: (history || []).slice(0, 10),
      }),
    },
  ];

  try {
    const run = () =>
      withTimeout(
        client.chat.completions.create({
          model: MODEL,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
        TIMEOUT_MS
      );

    const out = await withRetry(run, { retries: 1, delay: 600 });
    const content = out?.choices?.[0]?.message?.content || "{}";
    const parsed = safeParseJSON(content, {});
    const summary = String(parsed.summary || "").trim() || "(no summary)";
    const next_actions = coerceActions(parsed.next_actions);

    return { summary, next_actions };
  } catch {
    return fallbackSummary(lead, history);
  }
}

/**
 * Score a lead (0-100) with short reasons.
 * Falls back to a simple heuristic when no key / on failure.
 */
export async function aiScoreLead(lead) {
  if (!client) {
    // heuristic fallback
    let score = 40;
    if (lead?.email) score += 15;
    if (lead?.phone || lead?.phone_norm) score += 15;
    if ((lead?.company || lead?.company_name || "").length > 1) score += 10;
    if ((lead?.stage || "").toLowerCase() === "proposal") score += 10;
    if ((lead?.status || "").toLowerCase() === "qualified") score += 10;

    return {
      score: clampScore(score),
      reasons: ["Heuristic (no AI key): contact info present, stage/status weighting"],
    };
  }

  const messages = [
    {
      role: "system",
      content:
        "Return ONLY JSON: {\"score\": 0-100, \"reasons\": string[]} representing likelihood of closing in 30-60 days.",
    },
    { role: "user", content: JSON.stringify({ lead }) },
  ];

  try {
    const run = () =>
      withTimeout(
        client.chat.completions.create({
          model: MODEL,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
        TIMEOUT_MS
      );

    const out = await withRetry(run, { retries: 1, delay: 600 });
    const content = out?.choices?.[0]?.message?.content || "{}";
    const parsed = safeParseJSON(content, {});
    const score = clampScore(Number(parsed.score));
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [];

    return { score, reasons };
  } catch {
    return { score: 50, reasons: ["AI error: using neutral fallback"] };
  }
}
