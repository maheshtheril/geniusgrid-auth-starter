// src/routes/leadsModule.routes.js
// World‑class Leads management: Leads CRUD + AI + History + Incentives
// - Single router you can mount at /api
// - Uses Postgres (pg) with a pool; requires tables from the SQL migration you ran
// - Sets app.user_id per request so DB triggers attribute history to the actor
// - Calculates incentives on close‑won via calc_incentive_amount()

import express from "express";
import { pool } from "../db/pool.js"; // make sure this exports a pg.Pool
import { requireAuth } from "../middleware/requireAuth.js"; // your auth middleware

const router = express.Router();

// --- helpers ---
const DEV_TENANT = "7db830a4-218f-4372-b34e-490d63bd58fc";
const DEV_USER   = "7db830a4-218f-4372-b34e-490d63bd58fc";

const getTenant = (req) =>
  req.session?.tenant_id || req.user?.tenant_id || req.headers["x-tenant-id"] || DEV_TENANT;

const getUserId = (req) => req.user?.id || DEV_USER;

async function withTx(req, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.user_id = $1", [getUserId(req)]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

// ------------------------------ LEADS: LIST ------------------------------
// GET /api/leads?page&size&q&status&owner&stage&priority&sortBy&sortDir
router.get("/leads", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req);
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(req.query.size || "25", 10)));
  const sortBy = ["updated_at","followup_at","score","ai_score","name","stage"].includes(req.query.sortBy) ? req.query.sortBy : "updated_at";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "").trim();
  const owner = (req.query.owner || "").trim();
  const stage = (req.query.stage || "").trim();
  const priority = (req.query.priority || "").trim();

  const params = [tenant];
  let where = `WHERE tenant_id = $1`;
  const add = (cond, val) => { params.push(val); where += ` AND ${cond.replace("$x", `$${params.length}`)}`; };

  if (q) add("(name ILIKE $x OR company ILIKE $x OR email ILIKE $x OR phone ILIKE $x)", `%${q}%`);
  if (status) add("status = $x", status);
  if (owner) add("(owner = $x OR owner_id::text = $x)", owner);
  if (stage) add("stage = $x", stage);
  if (priority) add("priority::text = $x", priority);

  const offset = (page - 1) * size;
  const listSQL = `
    SELECT id, name, company, email, phone, status, stage, owner, owner_id,
           score, ai_score, ai_summary, ai_next, followup_at, last_contact_at,
           next_action, priority, updated_at
    FROM public.leads
    ${where}
    ORDER BY ${sortBy} ${sortDir}
    LIMIT ${size} OFFSET ${offset};`;
  const countSQL = `SELECT COUNT(*)::int AS total FROM public.leads ${where};`;

  try {
    const [list, count] = await Promise.all([
      pool.query(listSQL, params),
      pool.query(countSQL, params),
    ]);
    const items = list.rows.map(r => ({
      ...r,
      ai_next: Array.isArray(r.ai_next) ? r.ai_next : (r.ai_next ? JSON.parse(r.ai_next) : [])
    }));
    res.json({ items, total: count.rows[0].total });
  } catch (e) { next(e); }
});

// ------------------------------ LEADS: CREATE ------------------------------
router.post("/leads", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req);
  await withTx(req, async (db) => {
    const b = req.body || {};
    if (!b.name?.trim()) return res.status(400).json({ error: "name required" });

    const sql = `
      INSERT INTO public.leads (
        tenant_id, name, company_id, company, email, phone, website,
        owner_id, owner, status, stage,
        followup_at, last_contact_at, closed_at, next_action, priority,
        source, campaign_id,
        score, ai_score, ai_summary, ai_next, ai_next_action,
        custom, tags_text, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,
        $12,$13,$14,$15,$16,
        $17,$18,
        $19,$20,$21,$22,$23,
        $24,$25, now(), now()
      )
      RETURNING *;`;

    const params = [
      tenant,
      b.name?.trim(), b.company_id || null, b.company || b.company_name || null,
      b.email || null, b.phone || null, b.website || null,
      b.owner_id || null, b.owner || null, b.status || "new", b.stage || null,
      b.followup_at || null, b.last_contact_at || null, b.closed_at || null, b.next_action || null, b.priority ?? 2,
      b.source || null, b.campaign_id || null,
      b.score ?? null, b.ai_score ?? null, b.ai_summary ?? null, JSON.stringify(b.ai_next || []), b.ai_next_action || null,
      JSON.stringify(b.custom || {}), (b.tags || []).join(",") || null,
    ];

    const r = await db.query(sql, params);
    const row = r.rows[0];
    row.ai_next = JSON.parse(row.ai_next || "[]");
    row.custom = JSON.parse(row.custom || "{}");
    res.status(201).json(row);
  }).catch(next);
});

// ------------------------------ LEADS: PATCH (partial) ------------------------------
router.patch("/leads/:id", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req); const { id } = req.params;
  await withTx(req, async (db) => {
    const allowed = new Set(["name","company","company_id","email","phone","website",
      "owner","owner_id","status","stage","followup_at","last_contact_at","closed_at",
      "next_action","priority","source","campaign_id","score","ai_score","ai_summary",
      "ai_next","ai_next_action","custom","tags"]);
    const b = req.body || {};
    const cols = []; const vals = []; let i = 1;

    for (const [k,v] of Object.entries(b)) {
      if (!allowed.has(k)) continue;
      if (k === "ai_next" || k === "custom") {
        cols.push(`${k} = $${i++}`); vals.push(JSON.stringify(v ?? (k === "ai_next" ? [] : {})));
      } else if (k === "tags") {
        cols.push(`tags_text = $${i++}`); vals.push((v||[]).join(","));
      } else {
        cols.push(`${k} = $${i++}`); vals.push(v);
      }
    }

    if (!cols.length) return res.status(400).json({ error: "no updatable fields" });
    vals.push(id, tenant);

    const sql = `UPDATE public.leads SET ${cols.join(", ")}, updated_at = now() WHERE id = $${i++} AND tenant_id = $${i} RETURNING *;`;
    const r = await db.query(sql, vals);
    if (!r.rowCount) return res.status(404).json({ error: "not found" });
    const row = r.rows[0];
    try { row.ai_next = JSON.parse(row.ai_next || "[]"); } catch {}
    try { row.custom  = JSON.parse(row.custom  || "{}"); } catch {}
    res.json(row);
  }).catch(next);
});

// ------------------------------ AI: refresh lead insights ------------------------------
router.post("/leads/:id/ai-refresh", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req); const { id } = req.params;
  await withTx(req, async (db) => {
    // TODO: replace mock with provider call; keep shape stable
    const score = Math.floor(60 + Math.random() * 40);
    const summary = "Lead shows high intent; follow up within 24–48 hours.";
    const nextSteps = ["Call tomorrow morning","Send 3-slide value deck","Book demo for Friday"];

    const r = await db.query(
      `UPDATE public.leads
       SET score=$1, ai_score=$2, ai_summary=$3, ai_next=$4, updated_at=now()
       WHERE id=$5 AND tenant_id=$6
       RETURNING id, score, ai_score, ai_summary, ai_next, updated_at;`,
      [score, score, summary, JSON.stringify(nextSteps), id, tenant]
    );
    if (!r.rowCount) return res.status(404).json({ error: "not found" });
    const row = r.rows[0]; row.ai_next = JSON.parse(row.ai_next || "[]");

    // Log history (optional extra signal beyond trigger)
    await db.query(
      `INSERT INTO public.lead_events(tenant_id, lead_id, event_type, created_by_id, visibility, payload)
       VALUES ($1,$2,'ai.scored',$3,'team', jsonb_build_object('to',$4))`,
      [tenant, id, getUserId(req), score]
    );

    res.json(row);
  }).catch(next);
});

// ------------------------------ HISTORY: timeline ------------------------------
// GET /api/leads/:id/history?limit=&cursor=&types=note.added,ai.scored
router.get("/leads/:id/history", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req); const { id } = req.params;
  const limit = Math.min(100, parseInt(req.query.limit || "30", 10));
  const after = req.query.cursor || null; // created_at cursor (ISO)
  const types = (req.query.types || "").split(",").filter(Boolean);

  const params = [tenant, id];
  let where = `WHERE tenant_id = $1 AND lead_id = $2`;
  if (types.length) { params.push(types); where += ` AND event_type = ANY($${params.length})`; }
  if (after) { params.push(after); where += ` AND created_at < $${params.length}`; }

  const sql = `
    SELECT id, event_type, created_at, created_by_id, visibility, payload
    FROM public.lead_events
    ${where}
    ORDER BY created_at DESC
    LIMIT ${limit};`;

  try {
    const r = await pool.query(sql, params);
    const items = r.rows;
    const nextCursor = items.length === limit ? items[items.length - 1].created_at : null;
    res.json({ items, nextCursor });
  } catch (e) { next(e); }
});

// ------------------------------ NOTES (example) ------------------------------
router.post("/leads/:id/notes", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req); const { id } = req.params; const { note, pinned } = req.body || {};
  if (!note?.trim()) return res.status(400).json({ error: "note required" });
  await withTx(req, async (db) => {
    await db.query(
      `INSERT INTO public.lead_events(tenant_id, lead_id, event_type, created_by_id, visibility, payload)
       VALUES ($1,$2,'note.added',$3,'team', jsonb_build_object('note',$4,'pinned',$5))`,
      [tenant, id, getUserId(req), note.trim(), !!pinned]
    );
    res.status(201).json({ ok: true });
  }).catch(next);
});

// ------------------------------ CLOSE‑WON → calculate incentive ------------------------------
// POST /api/leads/:id/close-won  { amount, plan_id }
router.post("/leads/:id/close-won", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req); const user = getUserId(req); const { id } = req.params;
  const { amount, plan_id } = req.body || {};
  if (!amount || amount <= 0) return res.status(400).json({ error: "amount required" });

  await withTx(req, async (db) => {
    // 1) Move lead to won
    const leadQ = await db.query(
      `UPDATE public.leads SET status='won', stage='won', closed_at=now(), updated_at=now()
       WHERE id=$1 AND tenant_id=$2 RETURNING id, ai_score;`, [id, tenant]
    );
    if (!leadQ.rowCount) return res.status(404).json({ error: "lead not found" });
    const aiScore = leadQ.rows[0].ai_score;

    // 2) Get plan (active or by id)
    let plan;
    if (plan_id) {
      const p = await db.query(`SELECT id, criteria FROM public.incentive_plans WHERE id=$1 AND tenant_id=$2`, [plan_id, tenant]);
      if (!p.rowCount) return res.status(400).json({ error: "plan not found" });
      plan = p.rows[0];
    } else {
      const p = await db.query(
        `SELECT id, criteria FROM public.incentive_plans
         WHERE tenant_id=$1 AND (start_date IS NULL OR start_date <= CURRENT_DATE)
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         ORDER BY updated_at DESC LIMIT 1`, [tenant]
      );
      if (!p.rowCount) return res.status(400).json({ error: "no active plan" });
      plan = p.rows[0];
    }

    // 3) Calculate incentive via DB function
    const calc = await db.query(`SELECT calc_incentive_amount($1::jsonb, $2::numeric, $3::numeric) AS amt`, [plan.criteria, amount, aiScore]);
    const payout = calc.rows[0].amt;

    // 4) Insert payout
    const ins = await db.query(
      `INSERT INTO public.lead_incentives (tenant_id, lead_id, user_id, incentive_plan_id, amount, ai_reasoning)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *;`,
      [tenant, id, user, plan.id, payout, `AI‑assisted payout based on plan and score ${aiScore ?? 'n/a'}`]
    );

    // 5) Log history event
    await db.query(
      `INSERT INTO public.lead_events(tenant_id, lead_id, event_type, created_by_id, visibility, payload)
       VALUES ($1,$2,'task.completed',$3,'team', jsonb_build_object('kind','close-won','amount',$4,'payout',$5))`,
      [tenant, id, user, amount, payout]
    );

    res.json({ lead_id: id, amount, payout, plan_id: plan.id, incentive: ins.rows[0] });
  }).catch(next);
});

// ------------------------------ Incentives summary ------------------------------
router.get("/incentives/summary", requireAuth, async (req, res, next) => {
  const tenant = getTenant(req);
  try {
    const r = await pool.query(
      `SELECT * FROM public.lead_incentives_summary WHERE tenant_id = $1 ORDER BY month DESC`, [tenant]
    );
    res.json({ items: r.rows });
  } catch (e) { next(e); }
});

export default router;
