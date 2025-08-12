// src/lib/ai.js

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // set your favorite

export async function summarizeLeadLLM(lead) {
  // Safe fallback if no key configured
  if (!OPENAI_API_KEY) {
    const basics = [
      lead.name && `Name: ${lead.name}`,
      lead.company && `Company: ${lead.company}`,
      lead.email && `Email: ${lead.email}`,
      lead.phone && `Phone: ${lead.phone}`,
      lead.stage && `Stage: ${lead.stage}`,
      lead.source && `Source: ${lead.source}`,
    ].filter(Boolean).join(" • ");
    return {
      summary: `Lead summary: ${basics || "no basics available"}.`,
      next_actions: [
        "Confirm contact details",
        "Schedule discovery call",
        "Qualify budget & timeline",
      ],
    };
  }

  const sys = `You are a CRM assistant. Summarize the lead in 2-3 sentences. Then output 3 concrete next actions as a JSON array of strings. Be concise.`;
  const user = `Lead JSON:\n${JSON.stringify(lead, null, 2)}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      temperature: 0.2,
    }),
  }).then(x => x.json());

  const text = r?.choices?.[0]?.message?.content?.trim() || "";
  let summary = text;
  let next_actions = [];

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try { next_actions = JSON.parse(jsonMatch[0]); } catch {}
    summary = text.replace(jsonMatch[0], "").trim().replace(/\s*Next actions:?$/i, "").trim();
  }
  if (!Array.isArray(next_actions) || !next_actions.length) {
    next_actions = ["Follow up with the lead", "Clarify needs", "Book a call"];
  }
  return { summary, next_actions };
}

export function scoreLeadHeuristics(lead) {
  // 0–100 baseline; you can replace with LLM scoring anytime
  let score = 50;
  const reasons = [];

  if (lead.email) { score += 10; reasons.push("Has email"); }
  if (lead.phone) { score += 10; reasons.push("Has phone"); }
  if (/@(gmail|yahoo|outlook)\./i.test(lead.email || "")) {
    reasons.push("Free email domain");
  } else if (lead.email) {
    score += 10; reasons.push("Corporate email");
  }
  if (lead.expected_revenue) {
    const v = Number(lead.expected_revenue);
    if (v >= 10000) { score += 10; reasons.push("High potential revenue"); }
  }
  if (lead.stage) {
    const bump = { prospect: 5, proposal: 8, negotiation: 10, closed: 0 }[lead.stage] || 0;
    if (bump) { score += bump; reasons.push(`Stage: ${lead.stage}`); }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}
