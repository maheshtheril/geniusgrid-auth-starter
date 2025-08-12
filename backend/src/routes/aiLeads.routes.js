import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const r = Router();

// POST /api/ai/leads/ingest
// body: { provider_code, external_ref?, candidates: [{name,email,phone,company,website,country_iso2,notes,payload}], autoConvert?: false }
r.post("/ai/leads/ingest", requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const tenantId = req.session.tenantId;
    const { provider_code, external_ref, candidates = [], autoConvert = false } = req.body || {};
    if (!provider_code || !Array.isArray(candidates)) {
      return res.status(400).json({ message: "provider_code and candidates[] required" });
    }

    await client.query("BEGIN");

    // upsert provider
    const { rows: provRows } = await client.query(
      `INSERT INTO ai_providers (tenant_id, code, name)
       VALUES ($1,$2,$2) ON CONFLICT (tenant_id,code)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tenantId, provider_code]
    );
    const providerId = provRows[0].id;

    // create job
    const { rows: jobRows } = await client.query(
      `INSERT INTO ai_jobs (tenant_id, provider_id, external_ref, status)
       VALUES ($1,$2,$3,'running') RETURNING id`,
      [tenantId, providerId, external_ref || null]
    );
    const jobId = jobRows[0].id;

    let created = 0, matched = 0, converted = 0;

    for (const raw of candidates) {
      const name = (raw.name || "").trim();
      const email = (raw.email || "").trim().toLowerCase() || null;
      const phone = (raw.phone || "").replace(/\D/g, "") || null;

      // potential match against existing leads
      const { rows: matchRows } = await client.query(
        `SELECT id, 0.0 as score
         FROM leads
         WHERE tenant_id=$1 AND (
           (email_norm IS NOT NULL AND email_norm = $2) OR
           (phone_norm IS NOT NULL AND phone_norm = $3)
         )
         LIMIT 5`,
        [tenantId, email, phone]
      );

      const status = matchRows.length ? "matched" : "new";
      const payload = raw.payload && typeof raw.payload === "object" ? raw.payload : raw;

      const { rows: candRows } = await client.query(
        `INSERT INTO ai_lead_candidates
          (tenant_id, job_id, source, name, company, email, phone, country_iso2, website, notes, payload, status, match_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [tenantId, jobId, raw.source || provider_code, name || null, raw.company || null,
         email, phone, (raw.country_iso2||"").toUpperCase() || null, raw.website || null,
         raw.notes || null, payload, status, matchRows.length ? 0.9 : 0.0]
      );
      const candidateId = candRows[0].id;
      created++;

      // store match links + event
      if (matchRows.length) {
        matched++;
        for (const m of matchRows) {
          await client.query(
            `INSERT INTO ai_lead_matches (candidate_id, lead_id, score, reason)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT DO NOTHING`,
            [candidateId, m.id, m.score || 0.9, { reason: "email/phone match" }]
          );
          await client.query(
            `SELECT public.add_lead_event($1,$2,'ai.candidate_matched', $3)`,
            [tenantId, m.id, { candidate_id: candidateId }]
          );
        }
      } else if (autoConvert) {
        const { rows: conv } = await client.query(
          `SELECT public.convert_candidate_to_lead($1) AS new_lead`,
          [candidateId]
        );
        if (conv[0]?.new_lead) converted++;
      } else {
        // timeline hint (virtual)
        // no-op: you could insert a "suggested" event into a phantom stream if you prefer
      }
    }

    await client.query(
      `UPDATE ai_jobs SET status='done', finished_at=now(),
        stats = jsonb_build_object('created', $1, 'matched', $2, 'converted', $3)
       WHERE id=$4`,
      [created, matched, converted, jobId]
    );

    await client.query("COMMIT");
    res.json({ jobId, created, matched, converted });
  } catch (e) {
    await client.query("ROLLBACK").catch(()=>{});
    next(e);
  } finally {
    client.release();
  }
});

// GET /api/ai/leads/candidates?status=new|matched|converted
r.get("/ai/leads/candidates", requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.session.tenantId;
    const { status = "new", limit = 50 } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM ai_lead_candidates
       WHERE tenant_id=$1 AND status=$2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, String(status), Math.min(200, Number(limit))]
    );
    res.json({ data: rows });
  } catch (e) { next(e); }
});

// POST /api/ai/leads/candidates/:id/convert  -> creates a Lead
r.post("/ai/leads/candidates/:id/convert", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT public.convert_candidate_to_lead($1) AS lead_id`,
      [req.params.id]
    );
    res.json({ lead_id: rows[0]?.lead_id });
  } catch (e) { next(e); }
});

export default r;
