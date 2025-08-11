// src/lib/api.js
import axios from "axios";

/**
 * Single axios instance for the app
 */
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://geniusgrid-auth-starter.onrender.com",
  withCredentials: true,
  timeout: 30000,
});

/**
 * Track identical in-flight GET requests so we can cancel the previous one.
 * Latest request wins; avoids bursts and accidental spamming.
 * Map key => AbortController
 */
const inflight = new Map();

function keyFor(config) {
  const u = new URL((config.baseURL || "") + config.url);
  const p = new URLSearchParams(config.params || {}).toString();
  const method = (config.method || "get").toLowerCase();
  return `${method} ${u.pathname}?${p}`;
}

function parseRetryAfter(headerValue) {
  // Retry-After can be seconds or an HTTP-date
  if (!headerValue) return null;
  const n = Number(headerValue);
  if (!Number.isNaN(n)) return n * 1000;
  const d = new Date(headerValue).getTime();
  if (!Number.isNaN(d)) {
    const ms = d - Date.now();
    return ms > 0 ? ms : 0;
  }
  return null;
}

/**
 * REQUEST interceptor
 * - Guard on required tenant/company context (if meta.requireContext is set)
 * - Deduplicate GETs by cancelling the previous identical one (latest-wins)
 */
api.interceptors.request.use((config) => {
  // Guard: require tenant/company context for certain calls
  if (config.meta?.requireContext) {
    if (!config.meta?.tenant_id || !config.meta?.company_id) {
      const err = new axios.Cancel("Missing tenant/company context");
      throw err;
    }
  }

  // Cancel previous identical GET (latest-wins)
  const method = (config.method || "get").toLowerCase();
  if (method === "get") {
    const key = keyFor(config);

    const prev = inflight.get(key);
    if (prev) prev.abort(); // cancel previous identical request

    const controller = new AbortController();
    inflight.set(key, controller);
    config.signal = controller.signal;
    config.__inflightKey = key; // for cleanup later
  }

  return config;
});

/**
 * RESPONSE interceptor
 * - Clean up inflight map
 * - Gentle backoff on 429 with Retry-After support (max 2 retries)
 */
api.interceptors.response.use(
  (response) => {
    const key = response.config?.__inflightKey;
    if (key) inflight.delete(key);
    return response;
  },
  async (error) => {
    const cfg = error?.config;
    const key = cfg?.__inflightKey;
    if (key) inflight.delete(key);

    const status = error?.response?.status;

    // Retry on 429 with small backoff
    if (cfg && status === 429) {
      cfg.__retryCount = (cfg.__retryCount || 0) + 1;
      if (cfg.__retryCount <= 2) {
        const retryHeader = error.response.headers?.["retry-after"];
        const fromHeader = parseRetryAfter(retryHeader);
        const fallback = Math.min(1500 * cfg.__retryCount, 3000); // 1.5s, 3s
        const wait = fromHeader ?? fallback;

        await new Promise((res) => setTimeout(res, wait));
        return api(cfg);
      }
    }

    // Pass other errors through
    throw error;
  }
);

export default api;
export { api };
