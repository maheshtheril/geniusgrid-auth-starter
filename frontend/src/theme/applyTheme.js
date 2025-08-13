// src/theme/applyTheme.js
const RUNTIME_STYLE_ID = "gg-theme-runtime";
// Default cycle order now: dark → light → night
const DEFAULT_ORDER = ["dark", "light", "night"];

/** Return the order of modes we should cycle through */
function getOrder(cfg) {
  const modes = cfg?.modes && Object.keys(cfg.modes);
  return Array.isArray(modes) && modes.length ? modes : DEFAULT_ORDER;
}

/** Build CSS text from a variables map: { "--bg": "#000", ... } */
function varsToCss(vars = {}) {
  const lines = [":root{"];
  for (const [k, v] of Object.entries(vars)) {
    if (!String(k).startsWith("--")) continue;
    if (v == null) continue;
    lines.push(`${k}:${String(v)};`);
  }
  lines.push("}");
  return lines.join("");
}

/** Ensure a single style element exists and return it */
function ensureRuntimeStyleEl() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(RUNTIME_STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = RUNTIME_STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Apply a theme mode at runtime.
 * @param {object} themeConfig - { modes: { light: {...}, dark: {...}, night: {...} } }
 * @param {string} mode
 */
export function applyTheme(themeConfig, mode) {
  if (typeof document === "undefined") return;

  const modes = themeConfig?.modes || {};
  const order = getOrder(themeConfig);
  const safeMode = modes[mode] ? mode : (order.find(m => modes[m]) || "dark");

  const vars = modes[safeMode] || {};
  const css = varsToCss(vars);

  const el = ensureRuntimeStyleEl();
  if (el) el.textContent = css;

  document.documentElement.setAttribute("data-theme", safeMode);
}

/** Decide the next mode to cycle to */
export function nextMode(themeConfig, current) {
  const order = getOrder(themeConfig);
  const i = Math.max(0, order.indexOf(current));
  return order[(i + 1) % order.length];
}

/** Optional: set initial theme at app bootstrap */
export function initTheme(themeConfig, preferred) {
  const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) || null;
  const initial = stored || preferred || "dark"; // dark as default
  applyTheme(themeConfig, initial);
}
