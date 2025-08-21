// src/lib/http.js
import axios from "axios";

/**
 * Base URL rules:
 * - DEV: keep ORIGIN empty ("") so requests go to the same origin; we’ll prefix "/api" in the interceptor.
 * - PROD: set VITE_API_ORIGIN to your API origin (NO trailing /api), e.g. https://geniusgrid-auth-starter.onrender.com
 *
 * Always call with either absolute URLs OR relative paths like:
 *   http.get("/api/leads")  // explicit
 *   http.get("leads")       // implicit; interceptor will prefix "/api/"
 */
const ORIGIN = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/+$/, "");

export const http = axios.create({
  baseURL: ORIGIN,                // origin only, never include "/api" here
  withCredentials: true,          // send session cookie (__erp_sid)
  headers: { "X-Requested-With": "XMLHttpRequest" },
  timeout: 20000,
});

// Ensure relative URLs are under "/api", and collapse accidental "/api/api"
http.interceptors.request.use((config) => {
  let url = config.url || "";

  // Absolute URLs (http/https or protocol-relative) are left as-is
  const isAbsolute = /^https?:\/\//i.test(url) || url.startsWith("//");

  if (!isAbsolute) {
    // normalize leading slash
    url = `/${url}`.replace(/^\/+/, "/");
    // force "/api" prefix if missing
    if (!url.startsWith("/api/")) url = `/api${url}`;
  }

  const base = (config.baseURL || "").replace(/\/+$/, "");
  // join and collapse duplicate "/api"
  const joined = `${base}${url}`.replace(/\/api\/api(\/|$)/, "/api$1");

  // Hand axios the final absolute/relative URL directly
  config.baseURL = "";      // prevent axios from re-joining
  config.url = joined;

  return config;
});

// Optional: small response normalizer (kept minimal)
http.interceptors.response.use(
  (res) => res,
  (err) => {
    // Keep the original error; just ensure a consistent shape
    if (!err.response) {
      err.response = { status: 0, data: { message: "Network error" } };
    }
    return Promise.reject(err);
  }
);
