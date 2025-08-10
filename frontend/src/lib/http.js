// src/lib/http.js
import axios from "axios";

const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/,""); // trim trailing slash

export const http = axios.create({
  baseURL: base,              // e.g. https://.../api
  withCredentials: true
});
