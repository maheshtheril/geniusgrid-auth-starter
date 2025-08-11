// frontend/src/hooks/useLeadsApi.js
import { get, post, patch } from "@/lib/api"; // or "../lib/api" if no alias

export default function useLeadsApi() {
  const listLeads   = (params)        => get("/leads", params);
  const getLead     = (id)            => get(`/leads/${id}`);
  const createLead  = (data)          => post("/leads", data);
  const updateLead  = (id, data)      => patch(`/leads/${id}`, data);
  const aiRefresh   = (id)            => post(`/leads/${id}/ai/refresh`, {});
  const listNotes   = (leadId, p)     => get(`/leads/${leadId}/notes`, p);
  const addNote     = (leadId, data)  => post(`/leads/${leadId}/notes`, data);
  const listHistory = (leadId, p)     => get(`/leads/${leadId}/history`, p);
  const listPipelines = ()            => get("/leads/pipelines", {});
  const bulkUpdate  = (payload)       => patch(`/leads/bulk`, payload);

  return { listLeads, getLead, createLead, updateLead, aiRefresh,
           listNotes, addNote, listHistory, listPipelines, bulkUpdate };
}
