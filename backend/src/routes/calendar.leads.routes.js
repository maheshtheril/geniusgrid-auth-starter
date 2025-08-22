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

// tiny utils
const toIso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const addMinutes = (d, mins) => new Date(new Date(d).getTime() + mins * 60000);

/* ---------------- GET /api/calendar/leads ----------------
   Responds with an array of FullCalendar events for the requested range.
   Prefers public.lead_events if available; otherwise falls back to leads.followup_at.
-------------------------------------------------------------------- */
router.get("/leads", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  if (companyId && !isUuid(companyId))
    return res.status(400).json({ error: "Invalid x-company-id (must be UUID)" });

  // Range (ISO strings). We accept any ISO; treat them as UTC instants.
  const fromISO = String(req.query.from || "").trim();
  const toISO = String(req.query.to || "").trim();
  if (!fromISO || !toISO) return res.status(400).json({ error: "from and to are required ISO datetimes" });

  const view = (req.query.view || "").toLowerCase(); // e.g. 'week' (not used server-side)
  const tz = req.query.tz || "UTC"; // not needed to filter; FullCalendar will render in its own tz

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const hasLeadEvents = await tableExists(client, "public.lead_events");
    let events = [];

    if (hasLeadEvents) {
      // Detect available columns to keep this resilient
      const cols = await getColumnsSet(client, "public", "lead_events");
      const want = {
        title: cols.has("title"),
        end_at: cols.has("end_at"),
        all_day: cols.has("all_day"),
        owner_id: cols.has("owner_id"),
        stage: cols.has("stage"),
      };

      // Build query from lead_events joined to leads for context
      const params = [fromISO, toISO, tenantId];
      let where = `WHERE (e.start_at < $2::timestamptz) AND (COALESCE(e.end_at, e.start_at + INTERVAL '45 minutes') > $1::timestamptz) AND e.tenant_id = ensure_tenant_scope()`;
      if (companyId) {
        params.push(companyId);
        where += ` AND l.company_id::text = $${params.length}`;
      }

      const sql = `
        SELECT
          e.id::text          AS event_id,
          e.lead_id::text     AS lead_id,
          e.start_at          AS start_at,
          ${want.end_at ? "e.end_at AS end_at," : "NULL::timestamptz AS end_at,"}
          ${want.all_day ? "COALESCE(e.all_day, false) AS all_day," : "false AS all_day,"}
          ${want.title ? "NULLIF(e.title,'') AS evt_title," : "NULL::text AS evt_title,"}
          ${want.owner_id ? "e.owner_id::text AS owner_id," : "l.owner_id::text AS owner_id,"}
          ${want.stage ? "NULLIF(e.stage,'') AS stage," : "l.stage AS stage,"}
          l.name              AS lead_name,
          COALESCE(l.company, l.company_name) AS company_name,
          COALESCE(l.owner, l.owner_name)     AS owner_name,
          l.status           AS status,
          l.source           AS source
        FROM public.lead_events e
        JOIN public.leads l ON l.id = e.lead_id
        ${where}
        ORDER BY e.start_at ASC
        LIMIT 500;
      `;
      const r = await client.query(sql, params);

      events = (r.rows || []).map((row) => ({
        id: `evt:${row.event_id}`,
        title:
          row.evt_title ||
          `Follow-up${row.company_name ? " • " + row.company_name : ""}`,
        start: toIso(row.start_at),
        end: toIso(row.end_at || addMinutes(row.start_at, 45)),
        allDay: !!row.all_day,
        // Let the frontend decide how to use this resource (owners/stages/timeline).
        resourceId: row.owner_id || undefined,
        extendedProps: {
          type: "lead_event",
          leadId: row.lead_id,
          stageName: row.stage || null,
          ownerUserId: row.owner_id || null,
          ownerName: row.owner_name || null,
          company: row.company_name || null,
          status: row.status || null,
          source: row.source || null,
          recurring: false,
          tz,
          view,
        },
      }));
    }

    // If no lead_events table, or it returned nothing, fall back to leads.followup_at
    if (!events.length) {
      const params = [tenantId, fromISO, toISO];
      let where = `WHERE tenant_id = ensure_tenant_scope() AND followup_at IS NOT NULL AND followup_at >= $2::timestamptz AND followup_at < $3::timestamptz`;
      if (companyId) {
        params.push(companyId);
        where += ` AND company_id::text = $${params.length}`;
      }

      const sql = `
        SELECT
          id::text AS lead_id,
          followup_at AS start_at,
          name AS lead_name,
          COALESCE(company, company_name) AS company_name,
          COALESCE(owner, owner_name)     AS owner_name,
          owner_id::text AS owner_id,
          stage, status, source
        FROM public.leads
        ${where}
        ORDER BY followup_at ASC
        LIMIT 500;`;
      const r = await client.query(sql, params);

      events = (r.rows || []).map((row) => ({
        id: `lead:${row.lead_id}`,
        title: `Follow-up${row.company_name ? " • " + row.company_name : ""}`,
        start: toIso(row.start_at),
        end: toIso(addMinutes(row.start_at, 45)),
        allDay: false,
        resourceId: row.owner_id || undefined, // frontend can remap for stage views
        extendedProps: {
          type: "lead_followup",
          leadId: row.lead_id,
          stageName: row.stage || null,
          ownerUserId: row.owner_id || null,
          ownerName: row.owner_name || null,
          company: row.company_name || null,
          status: row.status || null,
          source: row.source || null,
          recurring: false,
          tz,
          view,
        },
      }));
    }

    return res.json(events);
  } catch (err) {
    console.error("GET /api/calendar/leads error:", err);
    return res.status(500).json({ error: "Failed to load calendar leads" });
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
            AND tenant_id = ensure_tenant_scope()`,
        [start.toISOString(), end ? end.toISOString() : null, id]
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
            AND tenant_id = ensure_tenant_scope()`,
        [start.toISOString(), id]
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

export default router;
