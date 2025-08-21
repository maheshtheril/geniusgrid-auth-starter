// src/lib/http.js
import axios from "axios";

/**
 * Base URL rules:
 * - DEV: leave origin empty ("") so requests go to the same origin; we prefix "/api" below.
 * - PROD: set VITE_API_URL (preferred) or VITE_API_ORIGIN to your API origin (NO trailing /api),
 *         e.g. https://your-api.onrender.com
 *
 * Call sites can use:
 *   http.get("/api/leads")  // explicit path under /api
 *   http.get("leads")       // relative; interceptor will prefix "/api/"
 */

const API_ORIGIN = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_ORIGIN ||
  ""
).replace(/\/+$/, ""); // trim trailing slash

export const http = axios.create({
  baseURL: API_ORIGIN,              // origin only, never include "/api" here
  withCredentials: true,            // send session cookie (__erp_sid)
  headers: { "X-Requested-With": "XMLHttpRequest" },
  timeout: 20000,
});

// Prefix relative URLs with "/api" and collapse any "/api/api"
http.interceptors.request.use((config) => {
  let url = config.url || "";

  // Absolute URLs are left as-is
  const isAbsolute = /^https?:\/\//i.test(url) || url.startsWith("//");

  if (!isAbsolute) {
    // normalize leading slash
    url = `/${url}`.replace(/^\/+/, "/");
    // force "/api" prefix if missing
    if (!url.startsWith("/api/")) url = `/api${url}`;
  }

  const base = (config.baseURL || "").replace(/\/+$/, "");
  const joined = `${base}${url}`.replace(/\/api\/api(\/|$)/, "/api$1");

  // Hand axios the final URL directly
  config.baseURL = "";  // avoid re-joining
  config.url = joined;

  return config;
});

// Minimal response normalizer
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      err.response = { status: 0, data: { message: "Network error" } };
    }
    return Promise.reject(err);
  }
);

// Optional: one-time log to verify what got built (only in prod)
if (import.meta.env.PROD) {
  // eslint-disable-next-line no-console
  console.info("[CFG] API_ORIGIN =", API_ORIGIN || "(empty)");
}
