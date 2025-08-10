// src/lib/api.js
import { http } from "./http";

export function apiGet(path, config) {
  return http.get(path.replace(/^\/+/, ""), config);
}
export function apiPost(path, data, config) {
  return http.post(path.replace(/^\/+/, ""), data, config);
}
