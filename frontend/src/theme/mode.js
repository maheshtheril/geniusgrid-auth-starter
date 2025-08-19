// src/theme/mode.js
// Unified helpers that match your main.jsx storage keys and theme order.

import { applyTheme } from "./applyTheme";

export const THEME_ORDER = ["dark", "light", "night"];   // matches main.jsx
export const LS_KEYS = ["gg.theme", "theme"];            // matches main.jsx

export function readMode() {
  for (const k of LS_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v && THEME_ORDER.includes(v)) return v;
    } catch {}
  }
  return "dark";
}

export function saveMode(mode) {
  for (const k of LS_KEYS) {
    try { localStorage.setItem(k, mode); } catch {}
  }
}

export function setMode(mode, themeConfig) {
  // persist + apply immediately
  saveMode(mode);
  // main.jsx also listens to storage in other tabs; here we apply instantly
  try { applyTheme(themeConfig || window.__GG_THEME || {}, mode); } catch {}
}

export function cycleMode(current) {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length];
}
