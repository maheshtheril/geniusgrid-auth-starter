import { randomUUID } from "crypto";

// In-memory “job store” so we can simulate progress/events quickly.
const jobs = new Map();         // jobId -> { id, status, prompt, created_at, importId }
const events = new Map();       // jobId -> [ { ts, type, data } ]
const imports = new Map();      // importId -> { id, items: [...], committed: false }

function pushEvent(jobId, type, data) {
  const arr = events.get(jobId) || [];
  arr.push({ ts: new Date().toISOString(), type, data });
  events.set(jobId, arr);
}

function synthLead(i, prompt) {
  const companies = ["Aurelia Labs", "VertexIQ", "BluePeak Systems", "Quantiva", "NovaStack"];
  const titles = ["Head of Growth", "CTO", "Product Lead", "VP Sales", "Founder"];
  const cities = ["Bengaluru", "Mumbai", "Delhi", "Pune", "Chennai"];
  const industries = ["SaaS", "Fintech", "HealthTech", "EdTech", "AI/ML"];

  return {
    external_id: "mock-" + randomUUID(),
    name: `Prospect ${i}`,
    email: `prospect${i}@example.com`,
    mobile_country: "IN",
    mobile_code: "+91",
    mobile: "9" + String(100000000 + i),
    company: companies[i % companies.length],
    title: titles[i % titles.length],
    city: cities[i % cities.length],
    industry: industries[i % industries.length],
    source: "ai_prospecting",
    // extras visible in your UI
    ai_tags: ["mock", "synthetic", "high-intent"],
    insight_summary: `Generated from prompt: "${prompt}"`,
    relationship_score: Math.round(40 + (i * 7) % 55),
    trust_rating: Math.round(60 + (i * 9) % 40),
  };
}

export const mockProvider = {
  /**
   * Kick off a job. We immediately “progress” it with a small delay,
   * generate an import, and mark it ready.
   */
  async createJob({ prompt, qty = 25 }) {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    const job = { id, status: "queued", prompt, created_at, importId: null };
    jobs.set(id, job);
    events.set(id, []);
    pushEvent(id, "queued", { message: "Job queued" });

    // Simulate async progress
    setTimeout(() => {
      job.status = "running";
      pushEvent(id, "running", { step: "search", progress: 20 });
    }, 250);

    setTimeout(() => {
      pushEvent(id, "running", { step: "enrich", progress: 60 });
    }, 650);

    setTimeout(() => {
      // Build synthetic import payload
      const importId = randomUUID();
      const items = Array.from({ length: qty }, (_, i) => synthLead(i + 1, prompt));
      imports.set(importId, { id: importId, items, committed: false });

      job.importId = importId;
      job.status = "ready";

      pushEvent(id, "ready", { importId, count: items.length });
    }, 1200);

    return job;
  },

  async getJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) return null;
    return job;
  },

  async getEvents(jobId) {
    return events.get(jobId) || [];
  },

  async getImport(importId) {
    return imports.get(importId) || null;
  },

  async commitImport(importId) {
    const imp = imports.get(importId);
    if (!imp) return { committed: 0 };
    if (imp.committed) return { committed: 0 };

    imp.committed = true;
    // Here you’d write to your real Leads/Companies tables.
    // We just return a summary compatible with your UI.
    return {
      committed: imp.items.length,
      duplicates: 0,
      failed: 0,
    };
  },
};
