// src/lib/http.js
import axios from "axios";

const raw = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const base = raw.endsWith("/api") ? raw : `${raw}/api`; // <-- ensure /api

console.log("[HTTP] baseURL =", base); // one-time sanity log

export const http = axios.create({
  baseURL: base,
  withCredentials: true,
});
