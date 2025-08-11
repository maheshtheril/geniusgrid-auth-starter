// Centralized axios instance (cookie/session-based)
import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_URL || window.__API_BASE__ || "/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

// Helpers
export const get = (url, params) => api.get(url, { params }).then(r => r.data);
export const post = (url, data) => api.post(url, data).then(r => r.data);
export const patch = (url, data) => api.patch(url, data).then(r => r.data);
export const del = (url) => api.delete(url).then(r => r.data);
