// In-memory job/event/import store for AI Prospect
// Resets on server restart. Safe for demo/dev; swap to DB later.

import crypto from "node:crypto";

export const JOBS = new Map();     // jobId -> { id, status, import_job_id, created_at, updated_at }
export const EVENTS = new Map();   // jobId -> [ { id, ts, level, message } ]
export const IMPORTS = new Map();  // importId -> [ items ]

export const uid = () => crypto.randomUUID();

// Limit event log to avoid unbounded growth
const MAX_EVENTS_PER_JOB = 500;

export function pushEvent(jobId, level, message) {
  const e = { id: uid(), ts: new Date().toISOString(), level, message };
  const arr = EVENTS.get(jobId) || [];
  arr.push(e);
  if (arr.length > MAX_EVENTS_PER_JOB) arr.shift();
  EVENTS.set(jobId, arr);
}

export function setStatus(jobId, status) {
  const j = JOBS.get(jobId) || { id: jobId, created_at: new Date().toISOString() };
  j.status = status;
  j.updated_at = new Date().toISOString();
  JOBS.set(jobId, j);
}

export function attachImport(jobId, importId) {
  const j = JOBS.get(jobId) || { id: jobId, created_at: new Date().toISOString() };
  j.import_job_id = importId;
  j.updated_at = new Date().toISOString();
  JOBS.set(jobId, j);
}

// Optional helpers if you want to clear stale jobs periodically
export function clearAllProspectData() {
  JOBS.clear();
  EVENTS.clear();
  IMPORTS.clear();
}
