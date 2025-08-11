// src/lib/api.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "https://geniusgrid-auth-starter.onrender.com";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  timeout: 15000,
});

export const cleanParams = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v != null && !Number.isNaN(v))
  );

// add these named exports so existing imports work
export const get = (...args) => api.get(...args);
export const post = (...args) => api.post(...args);
export const patch = (...args) => api.patch(...args);
export const del = (...args) => api.delete(...args);
