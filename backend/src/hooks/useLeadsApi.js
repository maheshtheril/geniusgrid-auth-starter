import { useCallback } from "react";
import { get, post, patch } from "@/utils/api";

// NOTE: aligns with your leadsModule.routes.js capabilities
export default function useLeadsApi() {
  const listLeads = useCallback((params) => get("/leads", params), []);
  const getLead = useCallback((id) => get(`/leads/${id}`), []);
  const createLead = useCallback((data) => post("/leads", data), []);
  const updateLead = useCallback((id, data) => patch(`/leads/${id}`, data), []);
  const aiRefresh = useCallback((id) => post(`/leads/${id}/ai/refresh`, {}), []);
  const listNotes = useCallback((leadId, params) => get(`/leads/${leadId}/notes`, params), []);
  const addNote = useCallback((leadId, data) => post(`/leads/${leadId}/notes`, data), []);
  const listHistory = useCallback((leadId, params) => get(`/leads/${leadId}/history`, params), []);
  const listPipelines = useCallback(() => get("/leads/pipelines", {}), []);
  const bulkUpdate = useCallback((payload) => patch(`/leads/bulk`, payload), []);

  return {
    listLeads, getLead, createLead, updateLead,
    aiRefresh, listNotes, addNote, listHistory, listPipelines, bulkUpdate
  };
}
