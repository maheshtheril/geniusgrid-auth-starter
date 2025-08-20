// src/lib/strings.js
export const lower = (v) => String(v ?? "").toLowerCase();
export const normPath = (p) => {
  if (!p) return "";
  const s = String(p).trim();
  return s.startsWith("/") ? s.replace(/\/+$/, "") : "/" + s;
};
