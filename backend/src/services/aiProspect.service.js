import { pool } from "../db/pool.js";
import { processLeadImportCsv } from "./leadsImport.service.js";
import { pdlSearchPage } from "./providers/pdl.service.js";
import { clearbitLookupByEmail } from "./providers/clearbit.service.js";

/* ---------- util ---------- */
function phoneDigits(s=""){ return String(s).replace(/\D/g,""); }
function normPhone(s=""){ const d=phoneDigits(s); return d.length>10?d.slice(-10):d || null; }

function normCandidate(c) {
  const email = c.work_email || c.email || (Array.isArray(c.personal_emails) ? c.personal_emails[0] : "") || "";
  const phone = c.phone || (Array.isArray(c.phone_numbers) ? c.phone_numbers[0]?.number : "") || "";
  const name  = c.full_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(" ");
  return {
    name: name?.trim() || "",
    email: email?.trim() || "",
    phone: phone?.trim() || "",
    phone_norm: normPhone(phone),
    company: c.job_company_name || c.company || "",
    title: c.job_title || c.title || "",
    source: c.source || "pdl"
  };
}

function toCsv(rows = []) {
  if (!rows.length) return "";
  const headers = ["name","email","phone","company","title","source"];
  const esc = (v)=>v==null?"":(/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:String(v));
  return [headers.join(","), ...rows.map(r=>headers.map(h=>esc(r[h])).join(","))].join("\n");
}

async function logEvent(client, jobId, level, message, meta){
  await client.query(
    `INSERT INTO public.ai_prospect_events(job_id, level, message, meta) VALUES ($1,$2,$3,$4)`,
    [jobId, level, message, meta || null]
  );
}

/* ---------- quota ---------- */
async function checkQuota(client, tenantId, want) {
  const { rows: capR } = await client.query(
    `SELECT COALESCE((SELECT daily_cap FROM public.ai_prospect_quotas WHERE tenant_id=$1), 500) AS cap`,
    [tenantId]
  );
  const cap = capR[0]?.cap || 500;
  const { rows: usedR } = await client.query(
    `SELECT COALESCE(SUM(size),0) AS used
       FROM public.ai_prospect_jobs
      WHERE tenant_id=$1 AND created_at::date = now()::date`,
    [tenantId]
  );
  const used = Number(usedR[0]?.used || 0);
  if (used + want > cap) {
    throw new Error(`Daily cap exceeded (${used}/${cap})`);
  }
}

/* ---------- dedupe ---------- */
async function dedupeAgainstLeads(client, tenantId, items){
  if (!items.length) return { unique: items, duplicates: [] };
  const emails = items.map(x=>x.email).filter(Boolean);
  const phones = items.map(x=>x.phone_norm).filter(Boolean);
  const q = await client.query(
    `SELECT email, regexp_replace(coalesce(phone,''),'\\D','','g') AS phone_norm
       FROM public.leads
      WHERE tenant_id=ensure_tenant_scope()
        AND ( (email <> '' AND email = ANY($1)) OR (regexp_replace(coalesce(phone,''),'\\D','','g') <> '' AND regexp_replace(coalesce(phone,''),'\\D','','g') = ANY($2)) )`,
    [emails, phones]
  );
  const seenEmail = new Set(q.rows.map(r=>r.email).filter(Boolean));
  const seenPhone = new Set(q.rows.map(r=>r.phone_norm).filter(Boolean));

  const unique = [], duplicates = [];
  for (const it of items){
    const isDup = (it.email && seenEmail.has(it.email)) || (it.phone_norm && seenPhone.has(it.phone_norm));
    (isDup ? duplicates : unique).push(it);
  }
  return { unique, duplicates };
}

/* ---------- provider portfolio ---------- */
async function fetchFromProviders({ plan, size, signal, log }) {
  const pageSize = Math.min(50, size);
  let from = 0, got = [];
  while (got.length < size) {
    const { items, nextFrom } = await pdlSearchPage({
      query: plan.query,
      titleFilters: plan.titleFilters || [],
      country: plan.country || "",
      industry: plan.industry || "",
      size: Math.min(pageSize, size - got.length),
      from,
      signal
    });
    log("debug", `PDL page from=${from} items=${items.length}`);
    got.push(...items);
    if (nextFrom == null) break;
    from = nextFrom;
  }
  return got.map(r => ({ ...r, source: "pdl" }));
}

/* ---------- public: process a job id ---------- */
export async function processProspectJob(jobId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // claim job
    const { rows: jobs } = await client.query(
      `SELECT * FROM public.ai_prospect_jobs
        WHERE id=$1 AND status IN ('queued','failed')
        FOR UPDATE SKIP LOCKED`,
      [jobId]
    );
    if (!jobs.length) { await client.query("ROLLBACK"); return false; }

    const job = jobs[0];
    await checkQuota(client, job.tenant_id, job.size);

    await client.query(
      `UPDATE public.ai_prospect_jobs SET status='running', attempts=attempts+1, started_at=now(), error_text=NULL WHERE id=$1`,
      [jobId]
    );
    await logEvent(client, jobId, "info", "Job started", { size: job.size, providers: job.providers });

    await client.query("COMMIT"); // release row lock while we call providers
    /* ---------- outside txn: call providers ---------- */
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    const plan = {
      query: job.prompt,
      titleFilters: job.filters?.titleRoles || job.filters?.titles || [],
      country: job.filters?.country || "",
      industry: job.filters?.industry || ""
    };

    const eventsLog = async (lvl,msg,meta)=> {
      const c2 = await pool.connect();
      try { await logEvent(c2, jobId, lvl, msg, meta); } finally { c2.release(); }
    };

    const raw = await fetchFromProviders({ plan, size: job.size, signal, log: eventsLog });
    const normalized = raw.map(normCandidate);

    const c3 = await pool.connect();
    try {
      await c3.query("BEGIN");
      await logEvent(c3, jobId, "info", `Fetched ${normalized.length} candidates`);
      await c3.query(`UPDATE public.ai_prospect_jobs SET total_candidates=$2 WHERE id=$1`, [jobId, normalized.length]);

      // dedupe
      const { unique, duplicates } = await dedupeAgainstLeads(c3, job.tenant_id, normalized);
      await logEvent(c3, jobId, "info", `After dedupe: unique=${unique.length} duplicates=${duplicates.length}`);
      await c3.query(
        `UPDATE public.ai_prospect_jobs SET deduped_candidates=$2, duplicate_count=$3 WHERE id=$1`,
        [jobId, unique.length, duplicates.length]
      );

      // enrichment (optional clearbit by email)
      const enriched = [];
      for (const u of unique) {
        let e = null;
        if (u.email) {
          try { e = await clearbitLookupByEmail(u.email, { signal }); } catch {}
        }
        if (e?.person?.title && !u.title) u.title = e.person.title;
        if (e?.employment?.name && !u.company) u.company = e.employment.name;
        enriched.push(u);
      }

      // CSV + reuse import service
      const csv = toCsv(enriched);
      const buffer = Buffer.from(csv, "utf8");
      const importJob = await processLeadImportCsv({
        tenantId: job.tenant_id,
        userId: job.created_by,
        filename: "ai-prospect.csv",
        buffer,
        options: { source: "AI Prospecting" }
      });

      await c3.query(
        `UPDATE public.ai_prospect_jobs
            SET status='done', finished_at=now(), import_job_id=$2, inserted_count=$3
          WHERE id=$1`,
        [jobId, importJob?.id || importJob?.job?.id || null, enriched.length]
      );
      await logEvent(c3, jobId, "success", "Job completed", { import_job_id: importJob?.id || null });
      await c3.query("COMMIT");
    } catch (err) {
      await c3.query("ROLLBACK");
      throw err;
    } finally {
      c3.release();
    }
    return true;
  } catch (err) {
    try {
      await pool.query(
        `UPDATE public.ai_prospect_jobs SET status=CASE WHEN attempts+1>=max_attempts THEN 'failed' ELSE 'queued' END,
         error_text=$2, finished_at=now() WHERE id=$1`,
        [jobId, String(err?.message || err).slice(0, 1000)]
      );
      const c4 = await pool.connect();
      try { await logEvent(c4, jobId, "error", "Job failed", { error: String(err) }); } finally { c4.release(); }
    } catch {}
    return false;
  }
}