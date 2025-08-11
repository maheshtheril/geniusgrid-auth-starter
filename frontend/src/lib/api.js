// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://geniusgrid-auth-starter.onrender.com",
  withCredentials: true,
});

// coalesce identical GETs to avoid bursts
const inflight = new Map(); // key -> {promise, abort}

function keyFor(config) {
  const u = new URL((config.baseURL || "") + config.url);
  const p = new URLSearchParams(config.params || {}).toString();
  return `${config.method || "get"} ${u.pathname}?${p}`;
}

api.interceptors.request.use((config) => {
  // never fire when tenant/company unknown
  if (config.meta?.requireContext) {
    if (!config.meta?.tenant_id || !config.meta?.company_id) {
      const err = new axios.Cancel("Missing tenant/company context");
      return Promise.reject(err);
    }
  }

  // coalesce identical GETs
  if ((config.method || "get").toLowerCase() === "get") {
    const key = keyFor(config);
    if (inflight.has(key)) return inflight.get(key).promise;
    const controller = new AbortController();
    config.signal = controller.signal;
    const wrapped = api.request(config); // note: will be replaced by adapter, safe
    inflight.set(key, { promise: wrapped, abort: controller });
    wrapped.finally(() => inflight.delete(key));
    return wrapped;
  }
  return config;
});

// simple backoff for 429 respecting Retry-After
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { config, response } = error || {};
    if (!config || !response) throw error;

    if (response.status === 429) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      if (config.__retryCount > 2) throw error; // max 2 retries

      const retryAfter =
        Number(response.headers?.["retry-after"]) * 1000 ||
        Math.min(1500 * config.__retryCount, 3000); // 1.5s, 3s

      await new Promise((res) => setTimeout(res, retryAfter));
      return api(config);
    }

    throw error;
  }
);

export default api;
