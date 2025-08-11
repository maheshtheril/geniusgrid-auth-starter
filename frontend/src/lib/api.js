// frontend/src/lib/api.js
import axios from "axios";

const BASE =
  window.__API_BASE__ ||
  import.meta?.env?.VITE_API_URL ||
  "https://geniusgrid-auth-starter.onrender.com/api";

const http = axios.create({
  baseURL: BASE,
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

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

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.code === "ECONNABORTED") {
      err.message = `Request timed out after ${err.config?.timeout}ms: ${err.config?.method?.toUpperCase()} ${err.config?.url}`;
    }
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

// 🔑 Exports
export const api = http;                 // <-- named export for legacy imports
export const get   = (url, params) => http.get(url, { params });
export const post  = (url, data)   => http.post(url, data);
export const patch = (url, data)   => http.patch(url, data);
export default http;                     // default export also available
