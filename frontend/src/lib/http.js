// src/lib/http.js
import axios from "axios";

/**
 * Base URL rules:
 * - DEV: leave origin empty ("") so requests go to /api/... on the same origin (Vite proxy handles it)
 * - PROD: set VITE_API_ORIGIN to your API origin (NO trailing /api), e.g. https://geniusgrid-auth-starter-ddv5.onrender.com
 *
 * Keep auth.js calling "/api/..." — we normalize duplicates below.
 */
const ORIGIN = import.meta.env.VITE_API_ORIGIN || ""; // "" in dev, full https origin in prod

export const http = axios.create({
  baseURL: ORIGIN,            // <-- IMPORTANT: origin only, no "/api"
  withCredentials: true,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

// 🚑 De-duplicate accidental "/api/api" when baseURL+url join
http.interceptors.request.use((config) => {
  const base = (config.baseURL || "").replace(/\/+$/, "");  // trim trailing slashes
  const path = (config.url || "").replace(/^\/+/, "/");     // ensure single leading slash

  // If both sides include "/api", collapse it to single "/api"
  // e.g. base="" & url="/api/auth/login" -> "/api/auth/login" (fine)
  // e.g. base="/api" & url="/api/auth/login" -> "/api/auth/login" (fixed)
  const joined = `${base}${path}`.replace(/\/api\/api(\/|$)/, "/api$1");

  // axios will use full URL if you assign to `config.url` and clear baseURL
  config.baseURL = ""; // prevent axios from re-joining
  config.url = joined;

  return config;
});
