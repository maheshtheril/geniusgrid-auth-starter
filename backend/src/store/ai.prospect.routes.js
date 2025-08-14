// backend/src/store/ai.prospect.routes.js
// Prospecting (PDL-backed) with graceful fallback + tiny in-memory stores.

import express from "express";
import { randomUUID } from "crypto";

const router = express.Router();

// In-memory stores (ephemeral)
const JOBS = new Map();     // jobId -> { id, status, import_job_id, provider, events: [], created_at }
const IMPORTS = new Map();  // importId -> { id, items: [], created_at }

const nowISO = () => new Date().toISOString();

function addEvent(job, level, message) {
  const e = { id: randomUUID(), ts: nowISO(), level, message };
  job.events.push(e);
  return e;
}

/* ---------------- Normalization helpers ---------------- */

/**
 * Normalize "prompt" into an **inner** Elasticsearch query OBJECT.
 * - If prompt is a JSON string and already wrapped like { "query": { ... } }, unwrap to inner .query
 * - If prompt is a JSON string with { "bool": ... } or any ES clause, use it as-is
 * - Otherwise treat prompt as free text via simple_query_string
 */
function normalizePrompt(prompt) {
  if (typeof prompt !== "string") {
    return { match_all: {} };
  }
  const s = prompt.trim();
  if (!s) return { match_all: {} };

  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object") {
        if (obj.query && typeof obj.query === "object") {
          // Already wrapped; unwrap once
          return obj.query;
        }
        // Already an inner query (e.g., { "bool": {...} })
        return obj;
      }
    } catch {
      // fall through to text mode
    }
  }

  // Text mode: use simple_query_string on relevant fields; AND semantics.
  return {
    simple_query_string: {
      query: s,
      default_operator: "and",
      fields: [
        "full_name^1",
        "job_title^3",
        "job_company_name^2",
        "job_company_industry",
        "summary",
        "skills",
      ],
    },
  };
}

/* ---------------- Mapping helpers ---------------- */

function mapPDLItems(pdlJson = {}) {
  const arr = Array.isArray(pdlJson.data) ? pdlJson.data : [];
  return arr.slice(0, 200).map((p, i) => ({
    id: p.id || p.pid || `${Date.now()}-${i}`,
    name: p.full_name || p.name || "-",
    title: p.job_title || p.title || "-",
    company: p.job_company_name || p.organization || p.company || "-",
    email:
      p.work_email ||
      (Array.isArray(p.emails) && p.emails.length ? p.emails[0] : null) ||
      "-",
  }));
}

/* ---------------- External calls ---------------- */

async function fetchPDL(esInnerQuery, size) {
  const key = process.env.PDL_API_KEY?.trim();
  if (!key) throw new Error("Missing PDL_API_KEY");

  const url = "https://api.peopledatalabs.com/v5/person/search";

  // Make sure we only wrap **once** at the body level
  const body = {
    query: JSON.stringify(esInnerQuery), // PDL expects a STRING here
    size: Math.max(1, Math.min(Number(size) || 25, 200)),
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": key,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`PDL ${r.status}: ${txt || r.statusText}`);
  }
  return r.json();
}

/* ---------------- Mock generator ---------------- */

function makeMock(esInnerQuery, size) {
  const n = Math.max(1, Math.min(Number(size) || 10, 200));
  const summary = (() => {
    try {
      return JSON.stringify(esInnerQuery);
    } catch {
      return String(esInnerQuery);
    }
  })();
  const items = Array.from({ length: n }, (_, i) => ({
    id: randomUUID(),
    name: `Mock Lead ${i + 1}`,
    title: "Procurement Manager",
    company: `MockCo ${(i % 12) + 1}`,
    email: `lead${i + 1}@mockco.example`,
    _query: summary,
  }));
  return items;
}

/* ---------------- Routes ---------------- */

// Health
router.get("/ping", (_req, res) => res.json({ ok: true }));

// Create job
router.post("/jobs", async (req, res) => {
  const { prompt = "", size = 50, provider: reqProvider } = req.body || {};
  const useMock =
    reqProvider === "mock" ||
    process.env.USE_MOCK_AI === "1" ||
    !process.env.PDL_API_KEY;

  const id = randomUUID();
  const job = {
    id,
    status: "queued",
    import_job_id: null,
    provider: useMock ? "mock" : "pdl",
    events: [],
    created_at: nowISO(),
  };
  JOBS.set(id, job);

  addEvent(job, "info", "Queued job");

  // respond immediately so the client can poll
  res.status(201).json({
    id: job.id,
    status: job.status,
    import_job_id: job.import_job_id,
    provider: job.provider,
  });

  // async processing
  (async () => {
    try {
      job.status = "running";

      // Normalize prompt -> inner ES query object
      const esInner = normalizePrompt(prompt);

      let items = [];
      if (useMock) {
        addEvent(job, "info", "Using mock provider");
        items = makeMock(esInner, size);
      } else {
        addEvent(job, "info", "Calling PDL…");
        try {
          const pdlJson = await fetchPDL(esInner, size);
          addEvent(
            job,
            "success",
            `PDL returned ${Array.isArray(pdlJson?.data) ? pdlJson.data.length : 0} results`
          );
          items = mapPDLItems(pdlJson);
        } catch (e) {
          job.status = "failed";
          addEvent(job, "error", `PDL error: ${e?.message || String(e)}`);
          return;
        }
      }

      const importId = randomUUID();
      IMPORTS.set(importId, { id: importId, items, created_at: nowISO() });
      job.import_job_id = importId;
      addEvent(job, "info", `Prepared ${items.length} items for preview/import`);

      job.status = "completed";
      addEvent(job, "success", "Job completed");
    } catch (err) {
      job.status = "failed";
      addEvent(job, "error", `Failed: ${err?.message || String(err)}`);
    }
  })().catch(() => {});
});

// Job status
router.get("/jobs/:id", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ message: "Job not found" });
  res.json({
    id: job.id,
    status: job.status,
    import_job_id: job.import_job_id,
    provider: job.provider,
    created_at: job.created_at,
  });
});

// Job events (supports ?since=ISO)
router.get("/jobs/:id/events", (req, res) => {
  const job = JOBS.get(req.params.id);
  if (!job) return res.status(404).json({ message: "Job not found" });

  const since = req.query.since ? Date.parse(String(req.query.since)) : null;
  const out = since
    ? job.events.filter((e) => Date.parse(e.ts) > since)
    : job.events;
  res.json(out);
});

// Export for imports router
export function __getImport(importId) {
  return IMPORTS.get(importId) || null;
}

export default router;
