// ---------- FILE: src/pages/admin/_shared/fetcher.js ----------
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "";

export async function fetcher(path, { fallback } = {}){
  if (!API) return fallback ?? null;
  try {
    const { data } = await axios.get(`${API}${path}`, { withCredentials: true });
    return data;
  } catch (e) {
    return fallback ?? null;
  }
}

export async function poster(path, body){
  if (!API) throw new Error("API not configured");
  const { data } = await axios.post(`${API}${path}`, body, { withCredentials: true });
  return data;
}

export async function patcher(path, body){
  if (!API) throw new Error("API not configured");
  const { data } = await axios.patch(`${API}${path}`, body, { withCredentials: true });
  return data;
}

