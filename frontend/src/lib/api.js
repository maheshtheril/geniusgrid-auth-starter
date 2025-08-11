// src/lib/api.js
import axios from "axios";

/**
 * Ensure baseURL points at ".../api" (or same-origin "/api").
 * - If VITE_API_URL is unset → "/api"
 * - If VITE_API_URL is "https://host" → "https://host/api"
 * - If VITE_API_URL already includes "/api" at the start of its path → keep as-is
 */
function normalizeBaseURL(raw) {
  if (!raw) return "/api"; // same-origin default
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const u = new URL(raw, origin);
    const path = u.pathname.replace(/\/+$/, ""); // trim trailing slashes
    if (/^\/api(\/|$)/i.test(path)) {
      return `${u.origin}${path}`;
    }
    return `${u.origin}${path}/api`;
  } catch {
    // relative like "/backend" or "http://host" string fallback
    const trimmed = String(raw).replace(/\/+$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
}

const BASE = normalizeBaseURL(import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
  timeout: 30000,
});

// ---------- helpers ----------
export default api; // default export
export { api };    // named export

// convenience helpers (so files can do { get, post, patch, del })
const get   = (url, config)           => api.get(url, config);
const post  = (url, data, config)     => api.post(url, data, config);
const patch = (url, data, config)     => api.patch(url, data, config);
const del   = (url, config)           => api.delete(url, config);
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
        const ra = parseRetryAfter(error.response?.headers?.["retry-after"]);
        const fallback = Math.min(1500 * cfg.__retryCount, 3000);
        await new Promise((r) => setTimeout(r, ra ?? fallback));
        return api(cfg);
      }
    }

    throw error;
  }
);

// For visibility in console if needed
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.debug("[api] baseURL =", BASE);
}
