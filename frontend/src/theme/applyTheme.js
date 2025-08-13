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
 * Apply a theme mode at runtime (non-breaking signature).
 * @param {object} themeConfig - { modes: { light: {...}, dark: {...}, night: {...} } }
 * @param {string} mode
 */
export function applyTheme(themeConfig, mode) {
  if (typeof document === "undefined") return;

  const modes = themeConfig?.modes || {};
  const order = getOrder(themeConfig);

  // Choose a safe mode:
  // 1) if requested mode exists → use it
  // 2) else if localStorage has a known mode → use it
  // 3) else first available from order
  // 4) fallback to "dark"
  let safeMode = null;

  // prefer explicit mode first
  if (mode && modes[mode]) safeMode = mode;

  // then stored preference
  if (!safeMode) {
    try {
      const stored = localStorage.getItem("theme");
      if (stored && modes[stored]) safeMode = stored;
    } catch {}
  }

  // then first available from declared order
  if (!safeMode) {
    safeMode = order.find((m) => modes[m]) || null;
  }

  // final fallback
  if (!safeMode) safeMode = "dark";

  const vars = modes[safeMode] || {};
  const css = varsToCss(vars);

  const el = ensureRuntimeStyleEl();
  if (el) el.textContent = css;

  document.documentElement.setAttribute("data-theme", safeMode);

  // persist choice (safe, no-throw)
  try {
    localStorage.setItem("theme", safeMode);
  } catch {}
}

/** Decide the next mode to cycle to (non-breaking signature) */
export function nextMode(themeConfig, current) {
  const order = getOrder(themeConfig);
  const i = order.indexOf(current);
  const idx = i >= 0 ? i : 0;

  // pick next that actually exists in config.modes (skip missing ones)
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(idx + step) % order.length];
    if (!themeConfig?.modes || themeConfig.modes[candidate]) {
      return candidate;
    }
  }
  // fallback
  return "dark";
}

/**
 * Optional: set initial theme at app bootstrap (non-breaking signature).
 * Respects stored preference; defaults to "dark" if none.
 * Call early (e.g., in src/main.jsx) with your themeConfig.
 */
export function initTheme(themeConfig, preferred) {
  let initial = "dark"; // default
  try {
    const stored = localStorage.getItem("theme");
    if (stored && themeConfig?.modes?.[stored]) {
      initial = stored;
    } else if (preferred && themeConfig?.modes?.[preferred]) {
      initial = preferred;
    }
  } catch {}

  applyTheme(themeConfig, initial);
}
