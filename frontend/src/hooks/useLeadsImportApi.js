// src/hooks/useLeadsImportApi.js
import { useCallback } from "react";
import { get, post } from "@/lib/api";

export default function useLeadsImportApi() {
  const createImport = useCallback(async (file, options = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("options", JSON.stringify(options));
    const res = await post("/leads/imports", fd, { isMultipart: true });
    return res?.data || res;
  }, []);

  const getJob = useCallback(async (id) => {
    const res = await get(`/leads/imports/${id}`);
    return res?.data || res;
  }, []);

  const getRows = useCallback(async (id, params = {}) => {
    const res = await get(`/leads/imports/${id}/rows`, { params });
    return Array.isArray(res?.data) ? res.data : res;
  }, []);

  return { createImport, getJob, getRows };
}
