// frontend/src/lib/api.js
import axios from "axios";

// Figure out the API base URL (in this order)
const BASE =
  window.__API_BASE__ ||
  import.meta?.env?.VITE_API_URL ||
  "https://geniusgrid-auth-starter.onrender.com/api";

// Create a single axios instance
const http = axios.create({
  baseURL: BASE,
  withCredentials: true,       // send/read session cookie
  timeout: 30000,              // 30s so cold starts/preflights don't trip us
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest", // allowed by your server
  },
});

// Attach X-Company-ID from BOOTSTRAP or localStorage
http.interceptors.request.use((cfg) => {
  const companyId =
    window.BOOTSTRAP?.activeCompanyId ||
    localStorage.getItem("activeCompanyId") ||
    null;
  if (companyId && !cfg.headers["X-Company-ID"]) {
    cfg.headers["X-Company-ID"] = companyId;
  }
  return cfg;
});

// Normalize responses/errors to keep callers simple
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.code === "ECONNABORTED") {
      err.message = `Request timed out after ${err.config?.timeout}ms: ${err.config?.method?.toUpperCase()} ${err.config?.url}`;
    }
    // Surface useful info in console
    console.error("[API ERROR]", {
      url: err.config?.baseURL + err.config?.url,
      method: err.config?.method,
      status: err.response?.status,
      data: err.response?.data,
      code: err.code,
      message: err.message,
    });
    throw err;
  }
);

// Export helpers used by your hooks
export const get   = (url, params)      => http.get(url, { params });
export const post  = (url, data)        => http.post(url, data);
export const patch = (url, data)        => http.patch(url, data);

// (optional) export the instance for ad-hoc debugging
export default http;
