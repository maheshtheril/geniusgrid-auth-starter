// src/lib/api.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "https://geniusgrid-auth-starter.onrender.com";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  timeout: 15000
});

export function cleanParams(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "" || Number.isNaN(v)) continue;
    out[k] = v;
  }
  return out;
}
