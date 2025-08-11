// frontend/src/hooks/useLeadsApi.js
import api from "@/lib/api"; // NOTE: default import, not { get, post, patch }

const unwrap = (r) => (r && r.data !== undefined ? r.data : r);

export default function useLeadsApi() {
  const listPipelines = async () => {
    const data = unwrap(await api.get("/leads/pipelines"));
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.stages)
      ? data.stages
      : Array.isArray(data?.items)
      ? data.items
      : [];
    return arr
      .map((s) => (typeof s === "string" ? s : s?.name || s?.key || ""))
      .filter(Boolean);
  };

  const listLeads = async (params) => {
    const data = unwrap(await api.get("/leads", { params }));
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

  const getLead     = async (id)      => unwrap(await api.get(`/leads/${id}`));
  const createLead  = async (body)    => unwrap(await api.post("/leads", body));
  const updateLead  = async (id, body)=> unwrap(await api.patch(`/leads/${id}`, body));
  const aiRefresh   = async (id) => {
    try { return unwrap(await api.post(`/leads/${id}/ai-refresh`)); }
    catch { return unwrap(await api.post(`/leads/${id}/ai/refresh`)); }
  };

  const listNotes   = async (leadId, p) => unwrap(await api.get(`/leads/${leadId}/notes`,   { params: p }));
  const addNote     = async (leadId, b) => unwrap(await api.post(`/leads/${leadId}/notes`,  b));
  const listHistory = async (leadId, p) => unwrap(await api.get(`/leads/${leadId}/history`, { params: p }));
  const bulkUpdate  = async (payload)   => unwrap(await api.patch(`/leads/bulk`,            payload));

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
