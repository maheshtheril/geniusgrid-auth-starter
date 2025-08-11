// src/hooks/useLeadsApi.js
import { useCallback, useMemo } from "react";
import { get, post, patch } from "@/lib/api";

// double-unwrap for payloads like { data: { data: {...} } }
const unwrap = (x) => {
  let d = x && typeof x === "object" && "data" in x ? x.data : x;
  if (d && typeof d === "object" && "data" in d) d = d.data;
  return d;
};

// pick first array under common keys (or the value itself if already an array)
const pickArray = (obj, keys) => {
  for (const k of keys) if (Array.isArray(obj?.[k])) return obj[k];
  return Array.isArray(obj) ? obj : [];
};

// strip empty query params
const clean = (o = {}) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== null && v !== undefined));

export default function useLeadsApi() {
  // pipelines → MUST return string[]
  const listPipelines = useCallback(async () => {
    let raw;
    try { raw = await get("/leads/pipelines", { meta: { dedupe: true } }); }
    catch { raw = await get("/pipelines", { meta: { dedupe: true } }); }

    const data = unwrap(raw);
    const arr = pickArray(data, ["stages", "pipelines", "items", "data", "results"]);
    return arr
      .map((s) => (typeof s === "string" ? s : s?.name || s?.key || ""))
      .filter(Boolean);
  }, []);

  // list → always { items, total, page, size }
  const listLeads = useCallback(async (params) => {
    const p = clean({
      ...params,
      size: params?.size ?? params?.pageSize, // normalize "pageSize" → "size"
    });

    const raw = await get("/leads", { params: p, meta: { dedupe: true } });
    const data = unwrap(raw);
    const items = pickArray(data, ["items", "results", "data", "rows", "records", "leads", "nodes"]);

    return {
      items,
      total: Number(data?.total ?? data?.count ?? items.length ?? 0),
      page: Number(data?.page ?? p?.page ?? 1),
      size: Number(data?.size ?? p?.size ?? 25),
    };
  }, []);

  const getLead     = useCallback(async (id)      => unwrap(await get(`/leads/${id}`)), []);
  const createLead  = useCallback(async (body)    => unwrap(await post("/leads", body)), []);
  const updateLead  = useCallback(async (id, b)   => unwrap(await patch(`/leads/${id}`, b)), []);
  const aiRefresh   = useCallback(async (id) => {
    try { return unwrap(await post(`/leads/${id}/ai-refresh`, {})); }
    catch { return unwrap(await post(`/leads/${id}/ai/refresh`, {})); }
  }, []);

  const listNotes   = useCallback(async (leadId, p) => unwrap(await get(`/leads/${leadId}/notes`, { params: clean(p) })), []);
  const addNote     = useCallback(async (leadId, b) => unwrap(await post(`/leads/${leadId}/notes`, b)), []);
  const listHistory = useCallback(async (leadId, p) => unwrap(await get(`/leads/${leadId}/history`, { params: clean(p) })), []);
  const bulkUpdate  = useCallback(async (payload)   => unwrap(await patch(`/leads/bulk`, payload)), []);

  // return a stable object so dependents don't re-run every render
  return useMemo(() => ({
    listLeads, getLead, createLead, updateLead, aiRefresh,
    listNotes, addNote, listHistory, listPipelines, bulkUpdate
  }), [
    listLeads, getLead, createLead, updateLead, aiRefresh,
    listNotes, addNote, listHistory, listPipelines, bulkUpdate
  ]);
}
