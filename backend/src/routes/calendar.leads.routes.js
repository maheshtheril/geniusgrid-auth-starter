// src/routes/calendar.leads.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ---------------- helpers kept consistent with leads.routes.js ---------------- */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (x) => typeof x === "string" && UUID_RE.test(x);

function getTenantId(req) {
  return (
    req.session?.tenantId ||
    req.session?.tenant_id ||
    req.get("x-tenant-id") ||
    req.query.tenant_id ||
    null
  );
}
function getCompanyId(req) {
  return (
    req.session?.companyId ||
    req.session?.company_id ||
    req.get("x-company-id") ||
    req.query.company_id ||
    null
  );
}

async function setTenant(client, tenantId) {
  // keep your session var, but don't depend on it for filtering
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}
async function tableExists(client, qname /* 'public.lead_events' */) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS r`, [qname]);
  return !!rows[0]?.r;
}
async function getColumnsSet(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
    [schema, table]
  );
  return new Set(rows.map((r) => r.column_name));
}

/* simple schema snapshot for 'leads' that other routes also use */
async function getLeadsSchema(client) {
  const cols = await getColumnsSet(client, "public", "leads");
  return {
    has_followup_at: cols.has("followup_at"),
    has_owner_id: cols.has("owner_id"),
    has_owner_name: cols.has("owner_name") || cols.has("owner"),
    has_company_name: cols.has("company_name") || cols.has("company"),
    has_stage: cols.has("stage"),
    has_status: cols.has("status"),
  };
}

// tiny utils
const toIso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const addMinutes = (d, mins) => new Date(new Date(d).getTime() + mins * 60000);

/* ---------------- GET /api/calendar/leads ----------------
   Responds with an array of FullCalendar events for the requested range.
   Prefers public.lead_events if available; otherwise falls back to leads.followup_at.
   NOTE: We filter by tenant_id via query params (no ensure_tenant_scope()).
-------------------------------------------------------------------- */
router.get("/leads", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  if (companyId && !isUuid(companyId))
    return res.status(400).json({ error: "Invalid x-company-id (must be UUID)" });

  const ownerFilter = (req.query.owner || "").trim(); // optional: a single owner id

  const fromISO = String(req.query.from || "").trim();
  const toISO   = String(req.query.to   || "").trim();
  if (!fromISO || !toISO)
    return res.status(400).json({ error: "from and to are required ISO datetimes" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const rows = [];
    const hasLeadEvents = await tableExists(client, "public.lead_events");
    const leadsCols = await getColumnsSet(client, "public", "leads");

    // helpers for optional columns on leads
    const L = (name) => (leadsCols.has(name) ? `l.${name}` : null);
    const ownerNameExpr =
      (L("owner_name") && "l.owner_name") ||
      (L("owner") && "l.owner") ||
      "NULL";
    const companyNameExpr =
      (L("company_name") && L("company") && "COALESCE(l.company, l.company_name)") ||
      (L("company") && "l.company") ||
      (L("company_name") && "l.company_name") ||
      "NULL";
    const stageExpr = L("stage") ? "l.stage" : "NULL";
    const statusExpr = L("status") ? "l.status" : "NULL";
    const ownerIdExpr = L("owner_id") ? "l.owner_id::text" : "NULL";
    const followExpr = L("followup_at") ? "l.followup_at" : null;
    const companyIdFilterExpr = L("company_id") ? "l.company_id::text" : null;

    if (hasLeadEvents) {
      // detect optional columns on lead_events
      const ecols = await getColumnsSet(client, "public", "lead_events");
      const want = {
        title: ecols.has("title"),
        end_at: ecols.has("end_at"),
        all_day: ecols.has("all_day"),
        owner_id: ecols.has("owner_id"),
        stage: ecols.has("stage"),
      };

      const params = [fromISO, toISO, tenantId];
      let idx = params.length;

      let where = `
        WHERE (e.start_at < $2::timestamptz)
          AND (COALESCE(${want.end_at ? "e.end_at" : "e.start_at + INTERVAL '45 minutes'"},
                        e.start_at + INTERVAL '45 minutes') > $1::timestamptz)
          AND e.tenant_id = $3`;

      if (companyId && companyIdFilterExpr) {
        params.push(companyId);
        idx++;
        where += ` AND ${companyIdFilterExpr} = $${idx}`;
      }

      if (ownerFilter && (want.owner_id || leadsCols.has("owner_id"))) {
        params.push(ownerFilter);
        idx++;
        const evtOwner = want.owner_id ? "e.owner_id::text" : "NULL";
        const fallbackOwner = leadsCols.has("owner_id") ? "l.owner_id::text" : "NULL";
        where += ` AND COALESCE(${evtOwner}, ${fallbackOwner}) = $${idx}`;
      }

      const sql = `
        SELECT
          e.lead_id::text AS lead_id,
          ${want.title ? "NULLIF(e.title,'')" : "NULL"} AS evt_title,
          e.start_at AS start_at,
          ${want.end_at ? "e.end_at" : "NULL"} AS end_at,
          ${want.all_day ? "COALESCE(e.all_day,false)" : "false"}::bool AS all_day,
          COALESCE(${want.owner_id ? "e.owner_id::text" : "NULL"}, ${ownerIdExpr}) AS owner_id,
          ${want.stage ? "NULLIF(e.stage,'')" : "NULL"} AS stage,
          l.name AS lead_name,
          ${companyNameExpr} AS company_name,
          ${ownerNameExpr} AS owner_name,
          ${statusExpr} AS status
        FROM public.lead_events e
        JOIN public.leads l ON l.id = e.lead_id
        ${where}
        ORDER BY e.start_at ASC
        LIMIT 500;
      `;

      const r = await client.query(sql, params);
      for (const row of r.rows) {
        rows.push({
          id: row.lead_id,
          lead_id: row.lead_id,
          title: row.evt_title || row.lead_name || "Follow-up",
          name: row.lead_name,
          start_at: toIso(row.start_at),
          end_at: toIso(row.end_at || addMinutes(row.start_at, 45)),
          all_day: !!row.all_day,
          owner_id: row.owner_id || null,
          owner_user_id: row.owner_id || null,
          owner_name: row.owner_name || null,
          stage: row.stage || null,
          stage_name: row.stage || null,
          company: row.company_name || null,
          lead_company: row.company_name || null,
          status: row.status || null,
          rrule: null,
          instance_id: null,
        });
      }
    }

    // fallback to leads.followup_at if no events found
    if (!rows.length) {
      if (!followExpr) {
        return res.json([]); // schema doesn't have followup_at
      }

      const params = [fromISO, toISO, tenantId];
      let idx = params.length;
      let where = `
        WHERE l.tenant_id = $3
          AND ${followExpr} IS NOT NULL
          AND ${followExpr} < $2::timestamptz
          AND (${followExpr} + INTERVAL '45 minutes') > $1::timestamptz`;

      if (companyId && companyIdFilterExpr) {
        params.push(companyId);
        idx++;
        where += ` AND ${companyIdFilterExpr} = $${idx}`;
      }
      if (ownerFilter && ownerIdExpr !== "NULL") {
        params.push(ownerFilter);
        idx++;
        where += ` AND ${ownerIdExpr} = $${idx}`;
      }

      const sql = `
        SELECT
          l.id::text AS lead_id,
          ${followExpr} AS start_at,
          l.name AS lead_name,
          ${companyNameExpr} AS company_name,
          ${ownerNameExpr} AS owner_name,
          ${ownerIdExpr} AS owner_id,
          ${stageExpr} AS stage,
          ${statusExpr} AS status
        FROM public.leads l
        ${where}
        ORDER BY ${followExpr} ASC
        LIMIT 500;`;

      const r = await client.query(sql, params);
      for (const row of r.rows) {
        rows.push({
          id: row.lead_id,
          lead_id: row.lead_id,
          title: row.lead_name || "Follow-up",
          name: row.lead_name,
          start_at: toIso(row.start_at),
          end_at: toIso(addMinutes(row.start_at, 45)),
          all_day: false,
          owner_id: row.owner_id || null,
          owner_user_id: row.owner_id || null,
          owner_name: row.owner_name || null,
          stage: row.stage || null,
          stage_name: row.stage || null,
          company: row.company_name || null,
          lead_company: row.company_name || null,
          status: row.status || null,
          rrule: null,
          instance_id: null,
        });
      }
    }

    return res.json(rows);
  } catch (err) {
    // log full detail server-side
    console.error("GET /api/calendar/leads error:", err);
    // return a safe but slightly more helpful payload to the client
    return res.status(500).json({
      error: "Failed to load calendar leads",
      hint: process.env.NODE_ENV === "production" ? undefined : String(err?.message || err)
    });
  } finally {
    client.release();
  }
});

/* ---------------- GET /api/calendar/resources ---------------- */
router.get("/resources", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });
  const companyId = getCompanyId(req);
  const mode = String(req.query.mode || "").toLowerCase();

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const cols = await getColumnsSet(client, "public", "leads");
    const hasOwnerId = cols.has("owner_id");
    const hasOwnerName = cols.has("owner_name") || cols.has("owner");
    const ownerNameExpr =
      (cols.has("owner_name") && "owner_name") ||
      (cols.has("owner") && "owner") ||
      null;
    const hasStage = cols.has("stage");

    if (mode === "owners" || mode === "owner") {
      if (!hasOwnerId) return res.json([]);
      const params = [tenantId];
      let where = `WHERE tenant_id = $1 AND owner_id IS NOT NULL`;
      if (companyId && cols.has("company_id")) {
        params.push(companyId);
        where += ` AND company_id::text = $2`;
      }

      const r = await client.query(
        `SELECT DISTINCT owner_id::text AS id, ${ownerNameExpr || "NULL"} AS title
           FROM public.leads
           ${where}
          ORDER BY ${ownerNameExpr ? "title NULLS LAST" : "id"}
          LIMIT 500`,
        params
      );
      return res.json((r.rows || []).filter(x => x.id).map(x => ({
        id: x.id, title: x.title || x.id
      })));
    }

    // stages
    if (!hasStage) return res.json([]);
    const params = [tenantId];
    let where = `WHERE tenant_id = $1 AND stage IS NOT NULL AND stage <> ''`;
    if (companyId && cols.has("company_id")) {
      params.push(companyId);
      where += ` AND company_id::text = $2`;
    }

    const r = await client.query(
      `SELECT DISTINCT stage AS id
         FROM public.leads
         ${where}
         ORDER BY stage ASC
         LIMIT 200`,
      params
    );
    return res.json((r.rows || []).map(x => ({ id: String(x.id), title: String(x.id) })));
  } catch (e) {
    console.error("GET /api/calendar/resources error:", e);
    return res.status(500).json({ error: "Failed to load resources" });
  } finally {
    client.release();
  }
});

/* ---------------- GET /api/calendar/freebusy ---------------- */
router.get("/freebusy", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const fromISO = String(req.query.from || "").trim();
  const toISO   = String(req.query.to   || "").trim();
  let owners = req.query.owners;
  if (typeof owners === "string") owners = owners.split(",").map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(owners) || !owners.length || !fromISO || !toISO) return res.json([]);

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const out = [];
    const leadsCols = await getColumnsSet(client, "public", "leads");
    const hasLeadEvents = await tableExists(client, "public.lead_events");

    if (hasLeadEvents) {
      const r = await client.query(
        `
        SELECT
          COALESCE(e.owner_id::text, ${leadsCols.has("owner_id") ? "l.owner_id::text" : "NULL"}) AS owner_id,
          e.start_at AS start_at,
          COALESCE(e.end_at, e.start_at + INTERVAL '45 minutes') AS end_at
        FROM public.lead_events e
        JOIN public.leads l ON l.id = e.lead_id
       WHERE e.tenant_id = $3
         AND (e.start_at < $2::timestamptz)
         AND (COALESCE(e.end_at, e.start_at + INTERVAL '45 minutes') > $1::timestamptz)
         AND COALESCE(e.owner_id::text, ${leadsCols.has("owner_id") ? "l.owner_id::text" : "NULL"}) = ANY($4::text[])
       LIMIT 1000`,
        [fromISO, toISO, tenantId, owners]
      );
      for (const row of r.rows) {
        if (!row.owner_id) continue;
        out.push({ owner_id: row.owner_id, start: toIso(row.start_at), end: toIso(row.end_at) });
      }
    } else if (leadsCols.has("followup_at")) {
      const r = await client.query(
        `
        SELECT ${leadsCols.has("owner_id") ? "owner_id::text" : "NULL"} AS owner_id,
               followup_at AS start_at,
               (followup_at + INTERVAL '45 minutes') AS end_at
          FROM public.leads
         WHERE tenant_id = $3
           ${leadsCols.has("owner_id") ? "AND owner_id IS NOT NULL" : ""}
           AND followup_at < $2::timestamptz
           AND (followup_at + INTERVAL '45 minutes') > $1::timestamptz
           AND ${leadsCols.has("owner_id") ? "owner_id::text" : "NULL"} = ANY($4::text[])
         LIMIT 1000`,
        [fromISO, toISO, tenantId, owners]
      );
      for (const row of r.rows) {
        if (!row.owner_id) continue;
        out.push({ owner_id: row.owner_id, start: toIso(row.start_at), end: toIso(row.end_at) });
      }
    }

    res.json(out);
  } catch (e) {
    console.error("GET /api/calendar/freebusy error:", e);
    res.status(500).json({ error: "Failed to load free/busy" });
  } finally {
    client.release();
  }
});


/* ---------------- PATCH /api/calendar/leads/:id ----------------
   Move/resize an event. For `evt:<lead_events.id>` updates lead_events.
   For `lead:<lead.id>` updates leads.followup_at (end duration ignored).
-------------------------------------------------------------------- */
router.patch("/leads/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const rawId = String(req.params.id || "");
  const isEvt = rawId.startsWith("evt:");
  const isLeadFollow = rawId.startsWith("lead:");

  if (!isEvt && !isLeadFollow)
    return res.status(400).json({ error: "Unknown event id format" });

  const start = req.body?.start ? new Date(req.body.start) : null;
  const end = req.body?.end ? new Date(req.body.end) : null;
  if (!start || Number.isNaN(+start))
    return res.status(400).json({ error: "start is required ISO datetime" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    if (isEvt) {
      const id = rawId.slice(4);
      if (!isUuid(id)) return res.status(400).json({ error: "Invalid event id" });

      const exists = await tableExists(client, "public.lead_events");
      if (!exists) return res.status(404).json({ error: "lead_events not available" });

      const { rowCount } = await client.query(
        `UPDATE public.lead_events
            SET start_at = $1::timestamptz,
                end_at   = COALESCE($2::timestamptz, $1::timestamptz + INTERVAL '45 minutes'),
                updated_at = NOW()
          WHERE id = $3::uuid
            AND tenant_id = $4`,
        [start.toISOString(), end ? end.toISOString() : null, id, tenantId]
      );
      if (!rowCount) return res.status(404).json({ error: "Event not found" });
      return res.json({ ok: true });
    } else {
      // lead:<id> -> update leads.followup_at
      const id = rawId.slice(5);
      if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id" });

      const { rowCount } = await client.query(
        `UPDATE public.leads
            SET followup_at = $1::timestamptz,
                updated_at  = NOW()
          WHERE id = $2::uuid
            AND tenant_id = $3`,
        [start.toISOString(), id, tenantId]
      );
      if (!rowCount) return res.status(404).json({ error: "Lead not found" });
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error("PATCH /api/calendar/leads/:id error:", err);
    return res.status(500).json({ error: "Failed to update event" });
  } finally {
    client.release();
  }
});

// PATCH /leads/:id/schedule   { followup_at?: ISO, start?: ISO }
router.patch("/:id/schedule", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const raw = req.body?.followup_at || req.body?.start;
  const dt  = raw ? new Date(raw) : null;
  if (!dt || Number.isNaN(+dt))
    return res.status(400).json({ error: "followup_at/start is required ISO datetime" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    if (!schema.has_followup_at) return res.status(400).json({ error: "followup_at not available in schema" });

    const params = [dt.toISOString(), id, tenantId];
    let extra = "";
    // only add company filter if column exists
    const leadsCols = await getColumnsSet(client, "public", "leads");
    if (companyId && leadsCols.has("company_id")) { params.push(companyId); extra = ` AND company_id::text = $4`; }

    const r = await client.query(
      `UPDATE public.leads
          SET followup_at = $1::timestamptz, updated_at = NOW()
        WHERE id = $2::uuid AND tenant_id = $3${extra}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /leads/:id/schedule error:", err);
    res.status(500).json({ error: "Failed to update schedule" });
  } finally {
    client.release();
  }
});

// PATCH /leads/:id/owner   { owner_id: UUID }
router.patch("/:id/owner", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const ownerId = String(req.body?.owner_id || "").trim();
  if (!isUuid(ownerId)) return res.status(400).json({ error: "owner_id must be UUID" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    if (!schema.has_owner_id) return res.status(400).json({ error: "owner_id not available in schema" });

    const params = [ownerId, id, tenantId];
    let extra = "";
    const leadsCols = await getColumnsSet(client, "public", "leads");
    if (companyId && leadsCols.has("company_id")) { params.push(companyId); extra = ` AND company_id::text = $4`; }

    const r = await client.query(
      `UPDATE public.leads
          SET owner_id = $1::uuid, updated_at = NOW()
        WHERE id = $2::uuid AND tenant_id = $3${extra}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /leads/:id/owner error:", err);
    res.status(500).json({ error: "Failed to update owner" });
  } finally {
    client.release();
  }
});

// PATCH /leads/:id/stage   { stage: string }
router.patch("/:id/stage", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const stage = String(req.body?.stage || "").trim();
  if (!stage) return res.status(400).json({ error: "stage is required" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    if (!schema.has_stage) return res.status(400).json({ error: "stage not available in schema" });

    const params = [stage, id, tenantId];
    let extra = "";
    const leadsCols = await getColumnsSet(client, "public", "leads");
    if (companyId && leadsCols.has("company_id")) { params.push(companyId); extra = ` AND company_id::text = $4`; }

    const r = await client.query(
      `UPDATE public.leads
          SET stage = $1::text, updated_at = NOW()
        WHERE id = $2::uuid AND tenant_id = $3${extra}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /leads/:id/stage error:", err);
    res.status(500).json({ error: "Failed to update stage" });
  } finally {
    client.release();
  }
});

export default router;
