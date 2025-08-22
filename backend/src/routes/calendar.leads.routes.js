// src/routes/calendar.leads.routes.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

/* ---------------- helpers ---------------- */
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
  // harmless even if you don't use it later
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

/** leads schema snapshot */
async function getLeadsSchema(client) {
  const cols = await getColumnsSet(client, "public", "leads");
  return {
    cols,
    has_followup_at: cols.has("followup_at"),
    has_owner_id: cols.has("owner_id"),
    has_stage: cols.has("stage"),
    has_status: cols.has("status"),
    has_company: cols.has("company") || cols.has("company_name"),
    has_owner_name: cols.has("owner_name") || cols.has("owner"),
  };
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

  const fromISO = String(req.query.from || "").trim();
  const toISO   = String(req.query.to   || "").trim();
  if (!fromISO || !toISO)
    return res.status(400).json({ error: "from and to are required ISO datetimes" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);

    const hasLeadEvents = await tableExists(client, "public.lead_events");
    const rows = [];

    if (hasLeadEvents) {
      // detect optional lead_events columns
      const evCols = await getColumnsSet(client, "public", "lead_events");
      const want = {
        title: evCols.has("title"),
        end_at: evCols.has("end_at"),
        all_day: evCols.has("all_day"),
        owner_id: evCols.has("owner_id"),
        stage: evCols.has("stage"),
      };

      // leads optional columns (owner_name/owner, company/company_name)
      const leadCols = await getColumnsSet(client, "public", "leads");
      const companyExpr =
        leadCols.has("company") && leadCols.has("company_name")
          ? "COALESCE(l.company, l.company_name)"
          : leadCols.has("company")
          ? "l.company"
          : leadCols.has("company_name")
          ? "l.company_name"
          : "NULL";
      const ownerNameExpr =
        leadCols.has("owner_name") && leadCols.has("owner")
          ? "COALESCE(l.owner_name, l.owner)"
          : leadCols.has("owner_name")
          ? "l.owner_name"
          : leadCols.has("owner")
          ? "l.owner"
          : "NULL";
      const leadOwnerIdExpr = leadCols.has("owner_id") ? "l.owner_id" : "NULL";

      const params = [fromISO, toISO, tenantId];
      let where = `
        WHERE (e.start_at < $2::timestamptz)
          AND (COALESCE(e.end_at, e.start_at + INTERVAL '45 minutes') > $1::timestamptz)
          AND e.tenant_id = $3::uuid
      `;
      if (companyId) { params.push(companyId); where += ` AND l.company_id::text = $4`; }

      const sql = `
        SELECT
          e.lead_id::text AS lead_id,
          ${want.title ? "NULLIF(e.title,'')" : "NULL"} AS evt_title,
          e.start_at AS start_at,
          ${want.end_at ? "e.end_at" : "NULL"} AS end_at,
          ${want.all_day ? "COALESCE(e.all_day,false)" : "false"}::bool AS all_day,
          COALESCE(${want.owner_id ? "e.owner_id" : "NULL"}, ${leadOwnerIdExpr})::text AS owner_id,
          ${want.stage ? "NULLIF(e.stage,'')" : "NULL"} AS stage,
          l.name AS lead_name,
          ${companyExpr} AS company_name,
          ${ownerNameExpr} AS owner_name,
          ${leadCols.has("status") ? "l.status" : "NULL"} AS status
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

    if (!rows.length) {
      // fallback to leads.followup_at (only if column exists)
      const schema = await getLeadsSchema(client);
      if (!schema.has_followup_at) {
        return res.json([]); // nothing to show in fallback mode
      }

      const cols = schema.cols;

      const companyExpr =
        cols.has("company") && cols.has("company_name")
          ? "COALESCE(company, company_name)"
          : cols.has("company")
          ? "company"
          : cols.has("company_name")
          ? "company_name"
          : "NULL";
      const ownerNameExpr =
        cols.has("owner_name") && cols.has("owner")
          ? "COALESCE(owner_name, owner)"
          : cols.has("owner_name")
          ? "owner_name"
          : cols.has("owner")
          ? "owner"
          : "NULL";

      const params = [fromISO, toISO, tenantId];
      let where = `
        WHERE tenant_id = $3::uuid
          AND followup_at IS NOT NULL
          AND followup_at < $2::timestamptz
          AND (followup_at + INTERVAL '45 minutes') > $1::timestamptz
      `;
      if (companyId) { params.push(companyId); where += ` AND company_id::text = $4`; }

      const sql = `
        SELECT
          id::text AS lead_id,
          followup_at AS start_at,
          name AS lead_name,
          ${companyExpr} AS company_name,
          ${ownerNameExpr} AS owner_name,
          ${schema.has_owner_id ? "owner_id::text" : "NULL"} AS owner_id,
          ${schema.has_stage ? "stage" : "NULL"} AS stage,
          ${schema.has_status ? "status" : "NULL"} AS status
        FROM public.leads
        ${where}
        ORDER BY followup_at ASC
        LIMIT 500;
      `;
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
    console.error("GET /api/calendar/leads error:", err?.message, err?.stack);
    return res.status(500).json({ error: "Failed to load calendar leads" });
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

    if (mode === "owners" || mode === "owner") {
      const params = [tenantId];
      let where = `WHERE tenant_id = $1::uuid AND owner_id IS NOT NULL`;
      if (companyId) { params.push(companyId); where += ` AND company_id::text = $2`; }

      const sql = `
        SELECT DISTINCT owner_id::text AS id, COALESCE(owner_name, owner) AS title
          FROM public.leads
          ${where}
         ORDER BY title NULLS LAST
         LIMIT 500`;
      const r = await client.query(sql, params);
      return res.json((r.rows || []).filter(x => x.id).map(x => ({
        id: x.id, title: x.title || x.id
      })));
    }

    // stages
    const params = [tenantId];
    let where = `WHERE tenant_id = $1::uuid AND stage IS NOT NULL AND stage <> ''`;
    if (companyId) { params.push(companyId); where += ` AND company_id::text = $2`; }

    const r = await client.query(
      `SELECT DISTINCT stage AS id
         FROM public.leads
         ${where}
         ORDER BY stage ASC
         LIMIT 200`, params
    );
    return res.json((r.rows || []).map(x => ({ id: String(x.id), title: String(x.id) })));
  } catch (e) {
    console.error("GET /api/calendar/resources error:", e?.message, e?.stack);
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
    if (await tableExists(client, "public.lead_events")) {
      const sql = `
        SELECT
          COALESCE(e.owner_id::text, l.owner_id::text) AS owner_id,
          e.start_at AS start_at,
          COALESCE(e.end_at, e.start_at + INTERVAL '45 minutes') AS end_at
        FROM public.lead_events e
        JOIN public.leads l ON l.id = e.lead_id
       WHERE e.tenant_id = $3::uuid
         AND (e.start_at < $2::timestamptz)
         AND (COALESCE(e.end_at, e.start_at + INTERVAL '45 minutes') > $1::timestamptz)
         AND COALESCE(e.owner_id::text, l.owner_id::text) = ANY($4::text[])
       LIMIT 1000`;
      const r = await client.query(sql, [fromISO, toISO, tenantId, owners]);
      for (const row of r.rows) {
        if (!row.owner_id) continue;
        out.push({ owner_id: row.owner_id, start: toIso(row.start_at), end: toIso(row.end_at) });
      }
    } else {
      const sql = `
        SELECT owner_id::text AS owner_id,
               followup_at AS start_at,
               (followup_at + INTERVAL '45 minutes') AS end_at
          FROM public.leads
         WHERE tenant_id = $3::uuid
           AND owner_id IS NOT NULL
           AND followup_at < $2::timestamptz
           AND (followup_at + INTERVAL '45 minutes') > $1::timestamptz
           AND owner_id::text = ANY($4::text[])
         LIMIT 1000`;
      const r = await client.query(sql, [fromISO, toISO, tenantId, owners]);
      for (const row of r.rows) {
        out.push({ owner_id: row.owner_id, start: toIso(row.start_at), end: toIso(row.end_at) });
      }
    }

    res.json(out);
  } catch (e) {
    console.error("GET /api/calendar/freebusy error:", e?.message, e?.stack);
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
            AND tenant_id = $4::uuid`,
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
            AND tenant_id = $3::uuid`,
        [start.toISOString(), id, tenantId]
      );
      if (!rowCount) return res.status(404).json({ error: "Lead not found" });
      return res.json({ ok: true });
    }
  } catch (err) {
    console.error("PATCH /api/calendar/leads/:id error:", err?.message, err?.stack);
    return res.status(500).json({ error: "Failed to update event" });
  } finally {
    client.release();
  }
});

/* ---------------- PATCH /api/calendar/:id/schedule ----------------
   { followup_at?: ISO, start?: ISO }
-------------------------------------------------------------------- */
router.patch("/:id/schedule", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const companyId = getCompanyId(req);
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "Invalid lead id (must be UUID)" });

  const raw = req.body?.followup_at || req.body?.start;
  const dt  = raw ? new Date(raw) : null;
  if (!dt || Number.isNaN(+dt)) return res.status(400).json({ error: "followup_at/start is required ISO datetime" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    if (!schema.has_followup_at) return res.status(400).json({ error: "followup_at not available in schema" });

    const params = [dt.toISOString(), id, tenantId];
    let extra = "";
    if (companyId) { params.push(companyId); extra = ` AND company_id::text = $4`; }

    const r = await client.query(
      `UPDATE public.leads
          SET followup_at = $1::timestamptz, updated_at = NOW()
        WHERE id = $2::uuid AND tenant_id = $3${extra}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /leads/:id/schedule error:", err?.message, err?.stack);
    res.status(500).json({ error: "Failed to update schedule" });
  } finally {
    client.release();
  }
});

/* ---------------- PATCH /api/calendar/:id/owner ----------------
   { owner_id: UUID }
-------------------------------------------------------------------- */
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
    if (companyId) { params.push(companyId); extra = ` AND company_id::text = $4`; }

    const r = await client.query(
      `UPDATE public.leads
          SET owner_id = $1::uuid, updated_at = NOW()
        WHERE id = $2::uuid AND tenant_id = $3${extra}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /leads/:id/owner error:", err?.message, err?.stack);
    res.status(500).json({ error: "Failed to update owner" });
  } finally {
    client.release();
  }
});

/* ---------------- PATCH /api/calendar/:id/stage ----------------
   { stage: string }
-------------------------------------------------------------------- */
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
    if (companyId) { params.push(companyId); extra = ` AND company_id::text = $4`; }

    const r = await client.query(
      `UPDATE public.leads
          SET stage = $1::text, updated_at = NOW()
        WHERE id = $2::uuid AND tenant_id = $3${extra}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Lead not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /leads/:id/stage error:", err?.message, err?.stack);
    res.status(500).json({ error: "Failed to update stage" });
  } finally {
    client.release();
  }
});

export default router;
