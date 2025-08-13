import fetch from "node-fetch";
import { randomUUID } from "crypto";

// Minimal PDL wrapper. Assumes your prompt has keywords for title/industry/city.
// You can later replace this with a proper parser and richer PDL filters.
const PDL_ENDPOINT = "https://api.peopledatalabs.com/v5/person/search";

function mapPDLToLead(p, prompt) {
  // Map PDL fields → your lead shape (adjust as needed for your DB)
  return {
    external_id: p.id || "pdl-" + randomUUID(),
    name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" "),
    email: p.work_email || p.personal_emails?.[0] || null,
    mobile_country: "IN",
    mobile_code: "+91",
    mobile: "",
    company: p.employment?.name || p.job_company_name || null,
    title: p.job_title || p.job_title_role || null,
    city: p.location?.name || p.location_name || null,
    industry: p.industry || p.job_industry || null,
    source: "ai_prospecting",
    ai_tags: ["pdl", "enriched"],
    insight_summary: `Derived via PDL from "${prompt}"`,
    relationship_score: 50,
    trust_rating: 80,
  };
}

export const pdlProvider = {
  async createJob({ prompt, qty = 25 }) {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    const job = { id, status: "running", prompt, created_at, importId: null };

    // naive prompt → query mapping; improve later
    const query = prompt;
    const size = Math.min(Math.max(Number(qty) || 25, 1), 100);

    const resp = await fetch(PDL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.PDL_API_KEY || "",
      },
      body: JSON.stringify({
        // PDL supports structured filters; for now use a simple keyword query
        query,
        size,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`PDL error ${resp.status}: ${text}`);
    }

    const json = await resp.json();
    const records = Array.isArray(json.data) ? json.data : [];
    const items = records.map((p) => mapPDLToLead(p, prompt));

    // mimic the same import contract as mock:
    const importId = randomUUID();
    // Store in a local module cache so the router can read it:
    pdlCache.imports.set(importId, { id: importId, items, committed: false });

    return { ...job, status: "ready", importId };
  },

  async getJob(jobId) {
    // For PDL we run synchronously above → always “ready”
    // You could persist jobs in DB if you prefer.
    return null; // the router will keep a volatile job map
  },

  async getEvents(_jobId) {
    // Synchronous path → single “ready” event is fine (router synthesizes)
    return [];
  },

  async getImport(importId) {
    return pdlCache.imports.get(importId) || null;
  },

  async commitImport(importId) {
    const imp = pdlCache.imports.get(importId);
    if (!imp) return { committed: 0 };
    if (imp.committed) return { committed: 0 };
    imp.committed = true;
    return { committed: imp.items.length, duplicates: 0, failed: 0 };
  },
};

// lightweight cache in module scope
const pdlCache = {
  imports: new Map(),
};
