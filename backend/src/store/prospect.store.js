// src/store/prospect.store.js (ESM)
import crypto from "node:crypto";

export const JOBS = new Map();     // jobId -> { id, status, import_job_id, created_at, updated_at }
export const EVENTS = new Map();   // jobId -> [ {id, ts, level, message} ]
export const IMPORTS = new Map();  // importId -> [items]

export const uid = () => crypto.randomUUID();

export function pushEvent(jobId, level, message) {
  const e = { id: uid(), ts: new Date().toISOString(), level, message };
  const arr = EVENTS.get(jobId) || [];
  arr.push(e);
  EVENTS.set(jobId, arr);
}

export function setStatus(jobId, status) {
  const j = JOBS.get(jobId) || { id: jobId };
  j.status = status;
  j.updated_at = new Date().toISOString();
  JOBS.set(jobId, j);
}

export function attachImport(jobId, importId) {
  const j = JOBS.get(jobId) || { id: jobId };
  j.import_job_id = importId;
  j.updated_at = new Date().toISOString();
  JOBS.set(jobId, j);
}
