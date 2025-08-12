// src/services/leadsImport.service.js
import { parse } from "@fast-csv/parse";
import { Readable } from "node:stream";
import { pool } from "../db/pool.js";
import { aiSummarizeAndSuggest, aiScoreLead } from "../services/ai.js";

/**
 * Minimal column mapper. Accepts many common headers.
 */
const FIELD_ALIASES = {
  name: ["name", "full_name", "lead_name"],
  email: ["email", "e-mail"],
  phone: ["phone", "mobile", "telephone", "phone_number"],
  company: ["company", "org", "organization"],
  source: ["source", "utm_source"],
  stage: ["stage", "pipeline_stage"],
  profession: ["profession", "title", "role"],
  followup_at: ["follow_up_date", "followup_at", "followup", "next_followup"],
};

function pickCol(row, names) {
  for (const n of names) {
    const key = Object.keys(row).find(
      (k) => k && k.toLowerCase().trim() === n
    );
    if (key) {
      const v = row[key];
      return typeof v === "string" ? v.trim() : v;
    }
  }
  return null;
}

function mapRow(row) {
  const lowerKeys = {};
  for (const [k, v] of Object.entries(row || {})) {
    lowerKeys[String(k || "").toLowerCase().trim()] = v;
  }
  const out = {};
  out.name = pickCol(lowerKeys, FIELD_ALIASES.name) || null;
  out.email = pickCol(lowerKeys, FIELD_ALIASES.email) || null;
  out.phone = pickCol(lowerKeys, FIELD_ALIASES.phone) || null;
  out.company = pickCol(lowerKeys, FIELD_ALIASES.company) || null;
  out.source = pickCol(lowerKeys, FIELD_ALIASES.source) || null;
  out.stage = pickCol(lowerKeys, FIELD_ALIASES.stage) || null;
  out.profession = pickCol(lowerKeys, FIELD_ALIASES.profession) || null;

  const fu = pickCol(lowerKeys, FIELD_ALIASES.followup_at);
  out.followup_at = fu ? new Date(fu) : null;

  return out;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || null;
const toBool = (v) =>
  v === true ||
  v === "true" ||
  v === "1" ||
  v === 1 ||
  v === "yes" ||
  v === "on";

/**
 * Enrich a single lead with AI (summary + next actions + score) in background.
 * We set the tenant scope on the connection so RLS / helpers work.
 */
async function enrichLeadBackground({ leadId, tenantId, actorId }) {
  const client = await pool.connect();
  try {
    // Set tenant scope for this connection
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);

    // Load lead + a bit of history for context
    const { rows: leadRows } = await client.query(
      `select * from public.leads where id = $1 and tenant_id = $2 limit 1`,
      [leadId, tenantId]
    );
    const lead = leadRows[0];
    if (!lead) return;

    const { rows: history } = await client.query(
      `select event_type, payload, created_at
         from public.lead_events
        where tenant_id = $1 and lead_id = $2
        order by created_at desc
        limit 10`,
      [tenantId, leadId]
    );

    // Summarize + suggest next actions
    const { summary, next_actions, model: usedModelA } =
      await aiSummarizeAndSuggest(lead, history);

    await client.query("BEGIN");

    await client.query(
      `insert into public.lead_ai_cache
         (tenant_id, lead_id, kind, model, data)
       values ($1,$2,'summary',$3,$4::jsonb)`,
      [
        tenantId,
        leadId,
        usedModelA || OPENAI_MODEL,
        JSON.stringify({ summary, next_actions }),
      ]
    );

    await client.query(
      `update public.leads
          set ai_summary = $1,
              ai_next    = $2::jsonb,
              updated_at = now()
        where id = $3 and tenant_id = $4`,
      [summary, JSON.stringify(next_actions || []), leadId, tenantId]
    );

    await client.query(
      `insert into public.lead_events
         (tenant_id, lead_id, event_type, payload, created_by_id)
       values ($1,$2,'ai_enriched',$3::jsonb,$4)`,
      [
        tenantId,
        leadId,
        JSON.stringify({
          summary_len: summary?.length || 0,
          next_actions_count: (next_actions || []).length,
          model: usedModelA || OPENAI_MODEL,
        }),
        actorId || null,
      ]
    );

    // Score
    const { score, reasons, model: usedModelB } = await aiScoreLead(lead);

    await client.query(
      `insert into public.lead_scores
         (tenant_id, lead_id, score, reasons)
       values ($1,$2,$3,$4::jsonb)`,
      [tenantId, leadId, score, JSON.stringify(reasons ?? null)]
    );

    await client.query(
      `update public.leads
          set ai_score = $1,
              updated_at = now()
        where id = $2 and tenant_id = $3`,
      [score, leadId, tenantId]
    );

    await client.query(
      `insert into public.lead_events
         (tenant_id, lead_id, event_type, payload, created_by_id)
       values ($1,$2,'ai_scored',$3::jsonb,$4)`,
      [
        tenantId,
        leadId,
        JSON.stringify({ score, model: usedModelB || OPENAI_MODEL }),
        actorId || null,
      ]
    );

    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    // Best-effort error event (outside txn)
    try {
      await client.query(
        `insert into public.lead_events
           (tenant_id, lead_id, event_type, payload, created_by_id)
         values ($1,$2,'ai_error',$3::jsonb,$4)`,
        [
          tenantId,
          leadId,
          JSON.stringify({ error: String(e?.message || e) }),
          actorId || null,
        ]
      );
    } catch {}
    // Do not throw; this runs out-of-band after the import completes
  } finally {
    client.release();
  }
}

/**
 * Process CSV buffer for a tenant, insert/update leads with de-dupe.
 * - De-dupe primarily by (tenant_id, phone_norm) index
 * - If no phone, we try email exact match (lower)
 * - If options.autoEnrich === true, we trigger AI enrichment (summary+score) in background for inserted leads
 */
export async function processLeadImportCsv({
  tenantId,
  userId,
  filename,
  buffer,
  options = {},
}) {
  const client = await pool.connect();
  const jobRes = await client.query(
    `INSERT INTO public.import_jobs
       (tenant_id, created_by_id, module, filename, status, options_json, started_at)
     VALUES ($1,$2,'lead',$3,'processing',$4::jsonb, now())
     RETURNING *`,
    [tenantId, userId || null, filename || "upload.csv", options || {}]
  );
  const job = jobRes.rows[0];

  let total = 0;
  let inserted = 0;
  let duplicate = 0;
  let failed = 0;

  const insertedLeadIds = [];
  const autoEnrich =
    toBool(options?.autoEnrich) ||
    toBool(options?.auto_enrich) ||
    toBool(options?.ai);

  // stream CSV
  const stream = Readable.from(buffer);
  const csv = stream.pipe(
    parse({ headers: true, ignoreEmpty: true, trim: true })
  );

  try {
    await client.query("BEGIN");

    for await (const rawRow of csv) {
      total += 1;
      const rowNo = total;
      const mapped = mapRow(rawRow);

      // Skip if no meaningful data
      if (!mapped.name && !mapped.email && !mapped.phone) {
        await client.query(
          `INSERT INTO public.import_job_rows
             (tenant_id, job_id, row_no, input_json, outcome)
           VALUES ($1,$2,$3,$4,'skipped')`,
          [tenantId, job.id, rowNo, rawRow]
        );
        continue;
      }

      try {
        // If email present, check if email already exists (unique-ish via lower(email))
        let existingId = null;
        if (mapped.email) {
          const emailCheck = await client.query(
            `SELECT id
               FROM public.leads
              WHERE tenant_id = $1 AND lower(email) = lower($2)
              LIMIT 1`,
            [tenantId, mapped.email]
          );
          existingId = emailCheck.rows[0]?.id || null;
        }

        // Try primary path: insert by phone first (phone_norm generated in DB)
        // If phone missing, insert anyway (won’t hit the phone_norm unique index).
        let insertedThis = false;
        let leadId = null;

        if (!existingId) {
          const ins = await client.query(
            `INSERT INTO public.leads
              (tenant_id, name, email, phone, company, source, stage, owner, profession, followup_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (tenant_id, phone_norm) DO NOTHING
             RETURNING id`,
            [
              tenantId,
              mapped.name,
              mapped.email,
              mapped.phone,
              mapped.company,
              mapped.source,
              mapped.stage || "new",
              null,
              mapped.profession,
              mapped.followup_at,
            ]
          );

          if (ins.rows.length > 0) {
            insertedThis = true;
            leadId = ins.rows[0].id;
          } else if (mapped.phone) {
            // conflict → duplicate (same phone_norm)
            const q = await client.query(
              `SELECT id FROM public.leads
                WHERE tenant_id=$1 AND phone_norm = public.phone_to_norm($2) LIMIT 1`,
              [tenantId, mapped.phone]
            );
            existingId = q.rows[0]?.id || null;
          }
        }

        if (!insertedThis && existingId) {
          leadId = existingId;
          duplicate += 1;

          await client.query(
            `INSERT INTO public.import_job_rows
               (tenant_id, job_id, row_no, input_json, outcome, lead_id)
             VALUES ($1,$2,$3,$4,'duplicate',$5)`,
            [tenantId, job.id, rowNo, rawRow, leadId]
          );

          // Optional: log event
          await client.query(
            `INSERT INTO public.lead_events
               (tenant_id, lead_id, event_type, payload)
             VALUES ($1,$2,'import_duplicate', $3::jsonb)`,
            [tenantId, leadId, { filename, rowNo }]
          );

          continue;
        }

        if (insertedThis) {
          inserted += 1;
          insertedLeadIds.push(leadId);

          await client.query(
            `INSERT INTO public.import_job_rows
               (tenant_id, job_id, row_no, input_json, outcome, lead_id)
             VALUES ($1,$2,$3,$4,'inserted',$5)`,
            [tenantId, job.id, rowNo, rawRow, leadId]
          );

          // Optional: log event
          await client.query(
            `INSERT INTO public.lead_events
               (tenant_id, lead_id, event_type, payload)
             VALUES ($1,$2,'imported', $3::jsonb)`,
            [tenantId, leadId, { filename, rowNo }]
          );
        } else {
          // no insert, no existing match (edge case)
          duplicate += 1; // treat as duplicate/skip to keep UX simple
          await client.query(
            `INSERT INTO public.import_job_rows
               (tenant_id, job_id, row_no, input_json, outcome)
             VALUES ($1,$2,$3,$4,'skipped')`,
            [tenantId, job.id, rowNo, rawRow]
          );
        }
      } catch (rowErr) {
        failed += 1;
        await client.query(
          `INSERT INTO public.import_job_rows
             (tenant_id, job_id, row_no, input_json, outcome, error_text)
           VALUES ($1,$2,$3,$4,'failed',$5)`,
          [tenantId, job.id, rowNo, rawRow, String(rowErr?.message || rowErr)]
        );
      }

      if (total % 50 === 0) {
        await client.query(
          `UPDATE public.import_jobs
             SET total_rows=$2, processed_rows=$2,
                 inserted_count=$3, duplicate_count=$4, failed_count=$5
           WHERE id=$1`,
          [job.id, total, inserted, duplicate, failed]
        );
      }
    } // for-await

    await client.query("COMMIT");

    // Mark job done
    await client.query(
      `UPDATE public.import_jobs
         SET total_rows=$2, processed_rows=$2,
             inserted_count=$3, duplicate_count=$4, failed_count=$5,
             status='completed', finished_at=now()
       WHERE id=$1`,
      [job.id, total, inserted, duplicate, failed]
    );

    // 🔥 Auto-enrich with AI (background, non-blocking)
    if (autoEnrich && insertedLeadIds.length > 0) {
      // run after the transaction & job complete
      setImmediate(async () => {
        for (const leadId of insertedLeadIds) {
          try {
            await enrichLeadBackground({
              leadId,
              tenantId,
              actorId: userId || null,
            });
          } catch (e) {
            // swallow — already best-effort inside
          }
        }
      });
    }

    return {
      ...job,
      total_rows: total,
      inserted_count: inserted,
      duplicate_count: duplicate,
      failed_count: failed,
      status: "completed",
      auto_enrich: !!autoEnrich,
      enriched_queued: autoEnrich ? insertedLeadIds.length : 0,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    await client.query(
      `UPDATE public.import_jobs
         SET status='failed', error_text=$2, finished_at=now()
       WHERE id=$1`,
      [job.id, String(err?.message || err)]
    );
    throw err;
  } finally {
    client.release();
  }
}
