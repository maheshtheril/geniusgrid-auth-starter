// src/pages/admin/_shared/fetcher.js
import axios from "axios";

/** Resolve API base URL
 * - Uses VITE_API_URL if set (e.g. https://api.yourapp.com)
 * - Falls back to /api (reverse proxy)
 */
const BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)) ||
  "/api";

function trimSlash(s = "") {
  return s.replace(/\/+$/, "");
}
const baseURL = trimSlash(BASE);

/** Axios instance */
export const api = axios.create({
  baseURL,
  withCredentials: true, // send cookies for auth/tenant RLS
  timeout: 15000,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  },
  // Make array params look like ?a=1&a=2 (backend-friendly)
  paramsSerializer: (params) => {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      if (Array.isArray(v)) v.forEach((x) => usp.append(k, x));
      else usp.append(k, v);
    });
    return usp.toString();
  },
});

/** Interceptors: normalize errors; broadcast 401 */
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // Let the app know (global listener can redirect to login)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("api:unauthorized"));
      }
    }
    return Promise.reject(err);
  }
);

/** Normalize URL so you can call with '/api/...' or '/...' safely
 * If baseURL already ends with '/api', strip leading '/api' from url.
 */
function normalizeUrl(url = "") {
  const baseEndsWithApi = /\/api$/i.test(baseURL);
  if (baseEndsWithApi && url.startsWith("/api/")) return url.slice(4);
  return url;
}

function dataFrom(err) {
  return err?.response?.data ?? null;
}
function messageFrom(err, fallback = "Request failed") {
  const d = dataFrom(err);
  if (typeof d === "string") return d;
  if (d?.message) return d.message;
  return err?.message || fallback;
}

function shouldThrow(err) {
  const s = err?.response?.status;
  // Throw on auth/permission and server errors; caller may want to handle.
  return s === 401 || s === 403 || s >= 500;
}

/** Core wrappers
 * All return response.data on success.
 * On failure: if fallback is provided, return fallback; otherwise throw.
 */

export async function fetcher(
  url,
  { params, headers, signal, timeout, fallback } = {}
) {
  try {
    const { data } = await api.get(normalizeUrl(url), {
      params,
      headers,
      signal,
      timeout,
    });
    return data;
  } catch (err) {
    if (shouldThrow(err)) throw err;
    if (fallback !== undefined) return fallback;
    throw new Error(messageFrom(err));
  }
}

export async function poster(
  url,
  body = {},
  { params, headers, signal, timeout, fallback } = {}
) {
  try {
    const { data } = await api.post(normalizeUrl(url), body, {
      params,
      headers,
      signal,
      timeout,
    });
    return data;
  } catch (err) {
    if (shouldThrow(err)) throw err;
    if (fallback !== undefined) return fallback;
    throw new Error(messageFrom(err));
  }
}

export async function patcher(
  url,
  body = {},
  { params, headers, signal, timeout, fallback } = {}
) {
  try {
    const { data } = await api.patch(normalizeUrl(url), body, {
      params,
      headers,
      signal,
      timeout,
    });
    return data;
  } catch (err) {
    if (shouldThrow(err)) throw err;
    if (fallback !== undefined) return fallback;
    throw new Error(messageFrom(err));
  }
}

export async function deleter(
  url,
  { params, headers, signal, timeout, fallback } = {}
) {
  try {
    const { data } = await api.delete(normalizeUrl(url), {
      params,
      headers,
      signal,
      timeout,
    });
    return data;
  } catch (err) {
    if (shouldThrow(err)) throw err;
    if (fallback !== undefined) return fallback;
    throw new Error(messageFrom(err));
  }
}

/** Upload helper (FormData). Accepts:
 *  - file (File/Blob) or
 *  - form (FormData) or
 *  - plain object { key: value }
 */
export async function uploader(
  url,
  payload,
  { params, headers, signal, timeout, fallback } = {}
) {
  let form;
  if (payload instanceof FormData) {
    form = payload;
  } else if (
    typeof File !== "undefined" &&
    (payload instanceof File || payload instanceof Blob)
  ) {
    form = new FormData();
    form.append("file", payload);
  } else {
    form = new FormData();
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) v.forEach((x) => form.append(k, x));
      else form.append(k, v);
    });
  }
  try {
    const { data } = await api.post(normalizeUrl(url), form, {
      params,
      headers: { ...(headers || {}), "Content-Type": "multipart/form-data" },
      signal,
      timeout,
    });
    return data;
  } catch (err) {
    if (shouldThrow(err)) throw err;
    if (fallback !== undefined) return fallback;
    throw new Error(messageFrom(err));
  }
}

/** Download a file (Blob) */
export async function downloader(
  url,
  { params, headers, signal, timeout } = {}
) {
  const res = await api.get(normalizeUrl(url), {
    params,
    headers,
    signal,
    timeout,
    responseType: "blob",
  });
  return res.data; // Blob
}

/** Convenience: build absolute URL for <a href> downloads when needed */
export function absUrl(path = "") {
  if (/^https?:\/\//i.test(path)) return path;
  const left = trimSlash(baseURL);
  const right = path.startsWith("/") ? path : `/${path}`;
  return `${left}${right}`;
}
