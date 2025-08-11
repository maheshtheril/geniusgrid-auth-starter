// frontend/src/hooks/useLeadsApi.js
import { get, post, patch } from "@/lib/api"; // or "../lib/api" if no alias

const unwrap = (x) => (x && typeof x === "object" && "data" in x ? x.data : x);

export default function useLeadsApi() {
  // pipelines → MUST return string[]
  const listPipelines = async () => {
    const raw = await get("leads/pipelines", { meta: { dedupe: true } });
    const data = unwrap(raw);

    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.stages)
      ? data.stages
      : Array.isArray(data?.items)
      ? data.items
      : [];

    // normalize to strings
    return arr
      .map((s) => (typeof s === "string" ? s : s?.name || s?.key || ""))
      .filter(Boolean);
  };

  // list → always { items, total, page, size }
  const listLeads = async (params) => {
    const raw = await get("leads", { params, meta: { dedupe: true } });
    const data = unwrap(raw);

    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data)
      ? data
      : [];

    return {
      items,
      total: Number(data?.total ?? items.length ?? 0),
      page: Number(data?.page ?? params?.page ?? 1),
      size: Number(data?.size ?? params?.pageSize ?? params?.size ?? 25),
    };
  };

  const getLead    = async (id)    => unwrap(await get(`leads/${id}`, { meta: { dedupe: true } }));
  const createLead = async (body)  => unwrap(await post("leads", body));
  const updateLead = async (id, body) => unwrap(await patch(`leads/${id}`, body));

  // backend path is /leads/:id/ai-refresh (not /ai/refresh)
  const aiRefresh = async (id) => {
    try {
      return unwrap(await post(`leads/${id}/ai-refresh`, {}));
    } catch (e) {
      // fallback to old path if your FE was using it
      return unwrap(await post(`leads/${id}/ai/refresh`, {}));
    }
  };

  const listNotes   = async (leadId, p) => unwrap(await get(`leads/${leadId}/notes`,   { params: p, meta: { dedupe: true } }));
  const addNote     = async (leadId, b) => unwrap(await post(`leads/${leadId}/notes`,  b));
  const listHistory = async (leadId, p) => unwrap(await get(`leads/${leadId}/history`, { params: p, meta: { dedupe: true } }));
  const bulkUpdate  = async (payload)   => unwrap(await patch(`leads/bulk`, payload));

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
