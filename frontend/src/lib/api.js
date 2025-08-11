// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://geniusgrid-auth-starter.onrender.com",
  withCredentials: true,
  timeout: 30000,
});

// ---------- helpers ----------
export default api;        // default export (unchanged)
export { api };           // named export (for files using { api })

// convenience helpers (so files can do { get, post, patch, del })
const get  = (url, config)          => api.get(url, config);
const post = (url, data, config)    => api.post(url, data, config);
const patch= (url, data, config)    => api.patch(url, data, config);
const del  = (url, config)          => api.delete(url, config);
export { get, post, patch, del };

// ---------- internals ----------
const inflight = new Map(); // key -> AbortController (only when dedupe is enabled)

function pathnameOf(url, base) {
  try { return new URL(url, base).pathname; } catch { return String(url || ""); }
}
function isAuthRoute(url, base) {
  const p = pathnameOf(url, base);
  return /^\/?api\/auth(\/|$)/i.test(p);
}
function keyFor(config) {
  const path = pathnameOf(config.url, config.baseURL);
  const qs = new URLSearchParams(config.params || {}).toString();
  const method = (config.method || "get").toLowerCase();
  return `${method} ${path}?${qs}`;
}
function parseRetryAfter(v) {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isNaN(n)) return n * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : Math.max(0, t - Date.now());
}

// ---------- interceptors ----------
api.interceptors.request.use((config) => {
  // Never block auth routes
  if (!isAuthRoute(config.url, config.baseURL)) {
    // Optional context guard: ONLY if you set meta.requireContext on that call
    if (config.meta?.requireContext) {
      if (!config.meta?.tenant_id || !config.meta?.company_id) {
        throw new axios.Cancel("Missing tenant/company context");
      }
    }

    // Optional dedupe: ONLY if you set meta.dedupe === true on that call
    const method = (config.method || "get").toLowerCase();
    if (config.meta?.dedupe && method === "get") {
      const key = keyFor(config);
      const prev = inflight.get(key);
      if (prev) prev.abort(); // latest wins
      const controller = new AbortController();
      inflight.set(key, controller);
      config.signal = controller.signal;
      config.__inflightKey = key;
    }
  }

  return config;
});

api.interceptors.response.use(
  (resp) => {
    const key = resp.config?.__inflightKey;
    if (key) inflight.delete(key);
    return resp;
  },
  async (error) => {
    const cfg = error?.config;
    const key = cfg?.__inflightKey;
    if (key) inflight.delete(key);

    // Gentle retry for 429 (never for /api/auth/*)
    if (cfg && !isAuthRoute(cfg.url, cfg.baseURL) && error?.response?.status === 429) {
      cfg.__retryCount = (cfg.__retryCount || 0) + 1;
      if (cfg.__retryCount <= 2) {
        const ra = parseRetryAfter(error.response.headers?.["retry-after"]);
        const fallback = Math.min(1500 * cfg.__retryCount, 3000);
        await new Promise((r) => setTimeout(r, ra ?? fallback));
        return api(cfg);
      }
    }

    throw error;
  }
);
