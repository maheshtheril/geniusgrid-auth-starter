// src/lib/api.js
import axios from "axios";

/** Normalize baseURL so it always points to the API root. */
function normalizeBaseURL(raw) {
  // Dev/default: hit the Vite proxy at /api
  if (!raw) return "/api";

  const s = String(raw).trim();

  // If they passed just an origin (with or without trailing slash), append /api
  if (/^https?:\/\/[^/]+\/?$/.test(s)) {
    return s.replace(/\/?$/, "/api");
  }

  // If they passed a path or a full URL with a path, trust it.
  return s;
}

const BASE_URL = normalizeBaseURL(import.meta.env.VITE_API_URL);
console.log("[HTTP] baseURL =", BASE_URL);

// ---------- axios instance ----------
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  paramsSerializer: {
    serialize: (params) => new URLSearchParams(params || {}).toString(),
  },
});

// Export both default and named for flexibility
export default api;
export { api };

// Convenience helpers (so callers can do { get, post, patch, del })
const get   = (url, config)       => api.get(url, config);
const post  = (url, data, config) => api.post(url, data, config);
const patch = (url, data, config) => api.patch(url, data, config);
const del   = (url, config)       => api.delete(url, config);
export { get, post, patch, del };

// ---------- internals for interceptors ----------
const inflight = new Map(); // key -> AbortController (used when meta.dedupe === true)

function pathnameOf(url, base) {
  try {
    return new URL(url, base).pathname;
  } catch {
    return String(url || "");
  }
}

function isAuthRoute(url, base) {
  const p = pathnameOf(url, base);
  // keep this narrow so only auth endpoints bypass guards/retries
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- request interceptor ----------
api.interceptors.request.use((config) => {
  // Optional context guard — only if the caller opts in
  if (!isAuthRoute(config.url, config.baseURL) && config.meta?.requireContext) {
    if (!config.meta?.tenant_id || !config.meta?.company_id) {
      throw new axios.Cancel("Missing tenant/company context");
    }
  }

  // Optional GET dedupe — only if the caller opts in via meta.dedupe
  const method = (config.method || "get").toLowerCase();
  if (!isAuthRoute(config.url, config.baseURL) && config.meta?.dedupe && method === "get") {
    const key = keyFor(config);
    const prev = inflight.get(key);
    if (prev) prev.abort(); // latest request wins
    const controller = new AbortController();
    inflight.set(key, controller);
    config.signal = controller.signal;
    config.__inflightKey = key;
  }

  return config;
});

// ---------- response / error interceptor ----------
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

    // Gentle backoff for 429 (but never for /api/auth/*)
    const status = error?.response?.status;
    if (
      cfg &&
      status === 429 &&
      !isAuthRoute(cfg.url, cfg.baseURL)
    ) {
      cfg.__retryCount = (cfg.__retryCount || 0) + 1;

      // up to 3 total tries
      if (cfg.__retryCount <= 3) {
        const ra = parseRetryAfter(error.response.headers?.["retry-after"]);
        // fallback backoff: 1s, 2s, 3s with a little jitter
        const base = Math.min(1000 * cfg.__retryCount, 3000);
        const jitter = Math.floor(Math.random() * 250);
        const wait = (ra ?? base) + jitter;

        console.warn(`[HTTP] 429 — retry ${cfg.__retryCount} in ${wait}ms`);
        await sleep(wait);
        return api(cfg);
      }
    }

    // Bubble everything else (and 429 after we exhaust retries)
    return Promise.reject(error);
  }
);
