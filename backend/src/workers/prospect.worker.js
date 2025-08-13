import { pool } from "../db/pool.js";
import { processProspectJob } from "../services/aiProspect.service.js";

const POLL_MS = Number(process.env.PROSPECT_POLL_MS || 1500);
const MAX_CONCURRENCY = Number(process.env.PROSPECT_CONCURRENCY || 2);

const sleepers = new Set();

async function pickNextJob() {
  const { rows } = await pool.query(
    `SELECT id FROM public.ai_prospect_jobs
      WHERE status='queued'
        AND tenant_id=ensure_tenant_scope()
      ORDER BY created_at ASC
      LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function runLoop() {
  const running = new Set();

  async function tick() {
    try {
      while (running.size < MAX_CONCURRENCY) {
        const jobId = await pickNextJob();
        if (!jobId) break;

        // Mark running inside processProspectJob (it claims row)
        const p = (async () => {
          try { await processProspectJob(jobId); }
          catch (e) { /* handled inside */ }
          finally { running.delete(p); }
        })();

        running.add(p);
      }
    } catch (e) {
      // log to stderr; DB may be down
      console.error("[prospect-worker] tick error", e?.message || e);
    } finally {
      const timer = setTimeout(tick, POLL_MS);
      sleepers.add(timer);
    }
  }

  tick();
}

if (process.env.WORKER_ROLE === "prospect" || process.env.ENABLE_PROSPECT_WORKER === "true") {
  console.log("[prospect-worker] starting");
  runLoop();
}