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
  await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
}

/* -------- minimal schema detector (cached) -------- */
let leadsSchemaCache = null;
let leadsSchemaFetchedAt = 0;
const SCHEMA_TTL_MS = 5 * 60 * 1000;

async function getLeadsSchema(client) {
  const now = Date.now();
  if (leadsSchemaCache && now - leadsSchemaFetchedAt < SCHEMA_TTL_MS) return leadsSchemaCache;

  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='leads'`
  );
  const set = new Set(rows.map((r) => r.column_name));
  const has = (c) => set.has(c);

  leadsSchemaCache = {
    has_id: has("id"),
    has_tenant_id: has("tenant_id"),
    has_company_id: has("company_id"),
    has_name: has("name"),
    has_followup_at: has("followup_at"),
    has_owner_id: has("owner_id"),
    has_owner: has("owner"),
    has_owner_name: has("owner_name"),
    has_company: has("company"),
    has_company_name: has("company_name"),
    has_stage: has("stage"),
    has_status: has("status"),
    has_created_at: has("created_at"),
    has_updated_at: has("updated_at"),
  };
  leadsSchemaFetchedAt = now;
  return leadsSchemaCache;
}

function buildProjection(schema) {
  const sel = [];
  sel.push("id", "tenant_id");

  if (schema.has_company_id) sel.push("company_id");
  else sel.push("NULL::uuid AS company_id");

  if (schema.has_name) sel.push("name"); else sel.push("''::text AS name");

  if (schema.has_followup_at) sel.push("followup_at");
  else sel.push("NULL::timestamptz AS followup_at");

  if (schema.has_owner_id) sel.push("owner_id"); else sel.push("NULL::uuid AS owner_id");

  if (schema.has_owner && schema.has_owner_name)
    sel.push("COALESCE(owner, owner_name) AS owner_name");
  else if (schema.has_owner) sel.push("owner AS owner_name");
  else if (schema.has_owner_name) sel.push("owner_name");
  else sel.push("NULL::text AS owner_name");

  if (schema.has_company && schema.has_company_name)
    sel.push("COALESCE(company, company_name) AS company_name");
  else if (schema.has_company) sel.push("company AS company_name");
  else if (schema.has_company_name) sel.push("company_name");
  else sel.push("NULL::text AS company_name");

  if (schema.has_stage && schema.has_status)
    sel.push("COALESCE(stage, status) AS stage_name");
  else if (schema.has_stage) sel.push("stage AS stage_name");
  else if (schema.has_status) sel.push("status AS stage_name");
  else sel.push("NULL::text AS stage_name");

  if (schema.has_created_at) sel.push("created_at"); else sel.push("NOW() AS created_at");
  if (schema.has_updated_at) sel.push("updated_at"); else sel.push("NOW() AS updated_at");

  return sel.join(", ");
}

/* ---------------- GET /api/calendar/leads ----------------
   Params:
   - from, to: ISO strings (required)
   - tz: IANA tz (optional, passthrough)
   - view: week|month|owners|stages|timeline (optional)
   - owner: UUID to filter (optional)
   - company_id: UUID to filter (optional; also supports header x-company-id)
---------------------------------------------------------- */
router.get("/leads", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const from = req.query.from && new Date(String(req.query.from));
  const to = req.query.to && new Date(String(req.query.to));
  if (!from || !to || isNaN(+from) || isNaN(+to)) {
    return res.status(400).json({ error: "from/to required (ISO)" });
  }

  const ownerFilter = (req.query.owner || "").trim();
  const companyId = getCompanyId(req) || (req.query.company_id || "").trim();
  if (companyId && !isUuid(companyId))
    return res.status(400).json({ error: "Invalid company_id (UUID)" });

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    const projection = buildProjection(schema);

    const params = [tenantId, from.toISOString(), to.toISOString()];
    let i = params.length;
    let where = `WHERE tenant_id = $1`;

    if (schema.has_followup_at) {
      where += ` AND followup_at >= $2 AND followup_at < $3`;
    } else {
      // no followup_at column – return nothing
      return res.json([]);
    }

    if (companyId) {
      params.push(companyId);
      where += ` AND company_id::text = $${++i}`;
    }
    if (ownerFilter && isUuid(ownerFilter) && schema.has_owner_id) {
      params.push(ownerFilter);
      where += ` AND owner_id::text = $${++i}`;
    }

    const orderBy = schema.has_followup_at ? "followup_at" :
                    schema.has_updated_at ? "updated_at" : "created_at";

    const sql = `SELECT ${projection}
                   FROM public.leads
                   ${where}
                   ORDER BY ${orderBy} ASC
                   LIMIT 5000`;
    const { rows } = await client.query(sql, params);

    const out = rows.map((r) => ({
      id: r.id,
      lead_id: r.id,
      title: r.name || "Follow-up",
      start: r.followup_at,
      end: null, // FE makes 30m default if missing
      all_day: false,
      owner_id: r.owner_id,
      owner_name: r.owner_name,
      stage: r.stage_name,
      company: r.company_name,
      rrule: null,
      instance_id: null,
    }));

    res.json(out);
  } catch (err) {
    console.error("GET /api/calendar/leads error:", err);
    res.status(500).json({ error: "Failed to load calendar" });
  } finally {
    client.release();
  }
});

/* ---------------- GET /api/calendar/resources ----------------
   ?mode=owners|stages
-------------------------------------------------------------- */
router.get("/resources", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const mode = String(req.query.mode || "owners").toLowerCase();
  if (!["owners", "stages"].includes(mode)) return res.json([]);

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);

    if (mode === "owners") {
      if (!schema.has_owner_id && !schema.has_owner && !schema.has_owner_name) return res.json([]);
      const sql = `
        SELECT DISTINCT
               ${schema.has_owner_id ? "owner_id::text" : "NULL::text"} AS id,
               COALESCE(
                 ${schema.has_owner ? "owner" : "NULL"},
                 ${schema.has_owner_name ? "owner_name" : "NULL"},
                 'Unassigned'
               ) AS title
          FROM public.leads
         WHERE tenant_id = $1
         ORDER BY title ASC
      `;
      const { rows } = await client.query(sql, [tenantId]);
      // When owner_id is null but we have a name, synthesize an ID
      const normalized = rows.map((r) => ({
        id: r.id || r.title || "unassigned",
        title: r.title || "Unassigned",
      }));
      res.json(normalized);
    } else {
      // stages
      const hasStageish = schema.has_stage || schema.has_status;
      if (!hasStageish) return res.json([]);
      const sql = `
        SELECT DISTINCT
               COALESCE(
                 ${schema.has_stage ? "stage" : "NULL"},
                 ${schema.has_status ? "status" : "NULL"},
                 ''
               ) AS title
          FROM public.leads
         WHERE tenant_id = $1
           AND COALESCE(
                 ${schema.has_stage ? "stage" : "NULL"},
                 ${schema.has_status ? "status" : "NULL"},
                 ''
               ) <> ''
         ORDER BY title ASC
      `;
      const { rows } = await client.query(sql, [tenantId]);
      res.json(rows.map((r) => ({ id: r.title, title: r.title })));
    }
  } catch (err) {
    console.error("GET /api/calendar/resources error:", err);
    res.status(500).json({ error: "Failed to load resources" });
  } finally {
    client.release();
  }
});

/* ---------------- GET /api/calendar/freebusy ----------------
   Params: from, to, owners (array or comma-separated)
   Returns background blocks per owner based on followups.
-------------------------------------------------------------- */
router.get("/freebusy", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "No tenant" });

  const from = req.query.from && new Date(String(req.query.from));
  const to = req.query.to && new Date(String(req.query.to));
  if (!from || !to || isNaN(+from) || isNaN(+to)) {
    return res.status(400).json({ error: "from/to required (ISO)" });
  }

  let owners = req.query.owners;
  if (typeof owners === "string") owners = owners.split(",").map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(owners)) owners = [];

  const client = await pool.connect();
  try {
    await setTenant(client, tenantId);
    const schema = await getLeadsSchema(client);
    if (!schema.has_followup_at) return res.json([]);

    const params = [tenantId, from.toISOString(), to.toISOString()];
    let i = params.length;
    let where = `WHERE tenant_id = $1 AND followup_at >= $2 AND followup_at < $3`;

    if (owners.length && schema.has_owner_id) {
      params.push(owners);
      where += ` AND owner_id::text = ANY($${++i}::text[])`;
    }

    const sql = `
      SELECT ${schema.has_owner_id ? "owner_id::text" : "NULL::text"} AS owner_id,
             followup_at AS start_at
        FROM public.leads
       ${where}
       LIMIT 5000
    `;
    const { rows } = await client.query(sql, params);

    // Simple 30-min busy blocks from each followup
    const out = rows.map((r) => {
      const start = new Date(r.start_at);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        owner_id: r.owner_id || "unassigned",
        start: start.toISOString(),
        end: end.toISOString(),
      };
    });

    res.json(out);
  } catch (err) {
    console.error("GET /api/calendar/freebusy error:", err);
    res.status(500).json({ error: "Failed to load freebusy" });
  } finally {
    client.release();
  }
});

export default router;
