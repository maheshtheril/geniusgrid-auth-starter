// src/lib/api.js
import axios from "axios";

/** Normalize baseURL so it ends with /api exactly once */
function normalizeBaseURL(raw) {
  let s = (raw || "https://geniusgrid-auth-starter.onrender.com").trim();
  if (s.endsWith("/")) s = s.slice(0, -1);
  if (!/\/api$/i.test(s)) s = s + "/api";
  return s;
}

const baseURL = normalizeBaseURL(import.meta.env.VITE_API_URL);

// ---------- axios instance ----------
const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
});

api.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
api.defaults.headers.common["Accept"] = "application/json";

// Dev hint (shows once)
if (import.meta?.env?.DEV) {
  // eslint-disable-next-line no-console
  console.info("[HTTP] baseURL =", baseURL);
}

// Export both styles
export default api;
export { api };

// Convenience helpers (no auto-dedupe by default to avoid CanceledError noise)
const get   = (url, config = {})       => api.get(url, config);
const post  = (url, data, config = {}) => api.post(url, data, config);
const patch = (url, data, config = {}) => api.patch(url, data, config);
const del   = (url, config = {})       => api.delete(url, config);
export { get, post, patch, del };

// Handy predicates for callers
export const isCanceled = (e) => axios.isCancel?.(e) || e?.code === "ERR_CANCELED";

// ---------- request throttle + optional dedupe ----------
const inflight = new Map();   // key -> AbortController
const lastStart = new Map();  // key -> timestamp
const THROTTLE_MS = 300;

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

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();

  // Only affect non-auth GETs
  if (!isAuthRoute(config.url, config.baseURL) && method === "get") {
    // Soft throttle identical GETs to reduce Render 429s
    const key = keyFor(config);
    const now = Date.now();
    const prev = lastStart.get(key);
    if (prev && now - prev < THROTTLE_MS) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS - (now - prev)));
    }
    lastStart.set(key, Date.now());

    // Optional dedupe: opt-in per request via meta.dedupe === true
    if (config.meta?.dedupe) {
      const prevCtrl = inflight.get(key);
      if (prevCtrl) prevCtrl.abort(); // latest-wins
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

    // Swallow quick duplicates cleanly at callsites (we still reject, but mark it)
    if (isCanceled(error)) {
      error.__canceled = true;
      return Promise.reject(error);
    }

    // Gentle retry for 429 (never for /api/auth/*)
    if (cfg && !isAuthRoute(cfg.url, cfg.baseURL) && error?.response?.status === 429) {
      cfg.__retryCount = (cfg.__retryCount || 0) + 1;
      if (cfg.__retryCount <= 2) {
        const ra = parseRetryAfter(error.response.headers?.["retry-after"]);
        // backoff with small jitter
        const fallback = Math.min(1500 * cfg.__retryCount, 3000) + Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, ra ?? fallback));
        return api(cfg);
      }
    }

    return Promise.reject(error);
  }
);
