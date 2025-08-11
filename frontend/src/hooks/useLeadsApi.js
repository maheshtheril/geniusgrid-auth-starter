// src/hooks/useLeadsApi.js
import { get, post, patch } from "@/lib/api";

// ---------- tiny utils ----------
const unwrap = (x) => {
  let d = x && typeof x === "object" && "data" in x ? x.data : x;
  if (d && typeof d === "object" && "data" in d) d = d.data;
  return d;
};

const pickArray = (obj, keys) => {
  for (const k of keys) if (Array.isArray(obj?.[k])) return obj[k];
  return Array.isArray(obj) ? obj : [];
};

const clean = (o = {}) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  );

// ---------- in-memory cache (cuts Render 429s) ----------
let pipelinesCache = null;
let pipelinesFetchedAt = 0;
const PIPELINES_TTL_MS = 2 * 60 * 1000; // 2 minutes

export default function useLeadsApi() {
  // pipelines → MUST return string[]
  const listPipelines = async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && pipelinesCache && now - pipelinesFetchedAt < PIPELINES_TTL_MS) {
      return pipelinesCache;
    }

    let raw;
    try {
      // preferred endpoint
      raw = await get("/leads/pipelines", { meta: { dedupe: true } });
    } catch {
      // fallback for older backends
      raw = await get("/pipelines", { meta: { dedupe: true } });
    }

    const data = unwrap(raw);
    const arr = pickArray(data, ["stages", "pipelines", "items", "data", "results"]);

    const stages = arr
      .map((s) => (typeof s === "string" ? s : s?.name || s?.key || s?.id || ""))
      .filter(Boolean);

    const safe = stages.length ? stages : ["New", "Qualified", "Proposal", "Won", "Lost"];
    pipelinesCache = safe;
    pipelinesFetchedAt = now;
    return safe;
  };

  // list → always { items, total, page, size }
  const listLeads = async (params = {}) => {
    const p = clean({
      ...params,
      size: params?.size ?? params?.pageSize, // normalize pageSize → size
    });

    // opt-in GET dedupe; canceled duplicates are ignored in the page (see LeadsPage)
    const raw = await get("/leads", { params: p, meta: { dedupe: true } });
    const data = unwrap(raw);

    const items = pickArray(data, [
      "items", "results", "data", "rows", "records", "leads", "nodes",
    ]);

    return {
      items,
      total: Number(data?.total ?? data?.count ?? items.length ?? 0),
      page: Number(data?.page ?? p?.page ?? 1),
      size: Number(data?.size ?? p?.size ?? 25),
    };
  };

  const getLead     = async (id)    => unwrap(await get(`/leads/${id}`));
  const createLead  = async (body)  => unwrap(await post("/leads", body));
  const updateLead  = async (id, b) => unwrap(await patch(`/leads/${id}`, b));

  const aiRefresh = async (id) => {
    try { return unwrap(await post(`/leads/${id}/ai-refresh`, {})); }
    catch { return unwrap(await post(`/leads/${id}/ai/refresh`, {})); }
  };

  const listNotes   = async (leadId, p) => unwrap(await get(`/leads/${leadId}/notes`,   { params: clean(p) }));
  const addNote     = async (leadId, b) => unwrap(await post(`/leads/${leadId}/notes`,  b));
  const listHistory = async (leadId, p) => unwrap(await get(`/leads/${leadId}/history`, { params: clean(p) }));
  const bulkUpdate  = async (payload)   => unwrap(await patch(`/leads/bulk`, payload));

  return {
    listLeads,
    getLead,
    createLead,
    updateLead,
    aiRefresh,
    listNotes,
    addNote,
    listHistory,
    listPipelines,
    bulkUpdate,
  };
}
