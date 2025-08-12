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
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  );

export default function useLeadsApi() {
  // -------- Pipelines (must return string[]) --------
  const listPipelines = useCallback(async () => {
    let raw;
    try {
      raw = await get("/leads/pipelines", { meta: { dedupe: true } });
    } catch {
      raw = await get("/pipelines", { meta: { dedupe: true } });
    }

    const data = unwrap(raw);
    const arr = pickArray(data, ["stages", "pipelines", "items", "data", "results"]);
    return arr
      .map((s) => (typeof s === "string" ? s : s?.name || s?.key || ""))
      .filter(Boolean);
  }, []);

  // -------- List (normalized shape) --------
  const listLeads = useCallback(async (params) => {
    const p = clean({
      ...params,
      size: params?.size ?? params?.pageSize, // normalize "pageSize" → "size"
    });

    const raw = await get("/leads", { params: p, meta: { dedupe: true } });
    const data = unwrap(raw);
    const items = pickArray(data, [
      "items",
      "results",
      "data",
      "rows",
      "records",
      "leads",
      "nodes",
    ]);

    return {
      items,
      total: Number(data?.total ?? data?.count ?? items.length ?? 0),
      page: Number(data?.page ?? p?.page ?? 1),
      size: Number(data?.size ?? p?.size ?? 25),
    };
  }, []);

  // -------- CRUD --------
  const getLead = useCallback(async (id) => unwrap(await get(`/leads/${id}`)), []);
  const createLead = useCallback(async (body) => unwrap(await post("/leads", body)), []);
  // Supports FormData for file custom fields (browser will set boundary)
  const createLeadMultipart = useCallback(
    async (formData) => unwrap(await post("/leads", formData)),
    []
  );
  const updateLead = useCallback(async (id, b) => unwrap(await patch(`/leads/${id}`, b)), []);

  // -------- AI endpoints --------
  const aiRefresh = useCallback(async (id) => {
    try {
      // preferred route
      return unwrap(await post(`/leads/${id}/ai-refresh`, {}));
    } catch {
      // legacy alias if present
      return unwrap(await post(`/leads/${id}/ai/refresh`, {}));
    }
  }, []);

  const aiScore = useCallback(async (id) => {
    try {
      return unwrap(await post(`/leads/${id}/ai-score`, {}));
    } catch (e) {
      // optional/ignore if backend route not present
      return { ok: false, error: e?.message || "ai-score failed" };
    }
  }, []);

  const aiArtifacts = useCallback(async (id) => {
    try {
      const raw = await get(`/leads/${id}/ai`, { meta: { dedupe: true } });
      return unwrap(raw);
    } catch {
      return [];
    }
  }, []);

  // -------- Notes / History --------
  const listNotes = useCallback(
    async (leadId, p) =>
      unwrap(await get(`/leads/${leadId}/notes`, { params: clean(p) })),
    []
  );
  const addNote = useCallback(
    async (leadId, b) => unwrap(await post(`/leads/${leadId}/notes`, b)),
    []
  );
  const listHistory = useCallback(
    async (leadId, p) =>
      unwrap(await get(`/leads/${leadId}/history`, { params: clean(p) })),
    []
  );

  // -------- Bulk --------
  const bulkUpdate = useCallback(
    async (payload) => unwrap(await patch(`/leads/bulk`, payload)),
    []
  );

  // -------- Utilities --------
  // GET /leads/check-mobile?phone=+91%209876543210 → { exists: boolean }
  const checkMobile = useCallback(
    async ({ mobile }) =>
      unwrap(
        await get(`/leads/check-mobile`, {
          params: { phone: mobile },
          meta: { dedupe: true },
        })
      ),
    []
  );

  // stable return so consumers don't re-render unnecessarily
  return useMemo(
    () => ({
      // lists
      listLeads,
      listPipelines,
      listHistory,
      listNotes,

      // crud
      getLead,
      createLead,
      createLeadMultipart,
      updateLead,
      bulkUpdate,

      // ai
      aiRefresh,
      aiScore,
      aiArtifacts,

      // utils
      addNote,
      checkMobile,
    }),
    [
      listLeads,
      listPipelines,
      listHistory,
      listNotes,
      getLead,
      createLead,
      createLeadMultipart,
      updateLead,
      bulkUpdate,
      aiRefresh,
      aiScore,
      aiArtifacts,
      addNote,
      checkMobile,
    ]
  );
}
