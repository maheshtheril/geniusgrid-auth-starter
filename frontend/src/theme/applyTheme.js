// src/theme/applyTheme.js
const RUNTIME_STYLE_ID = "gg-theme-runtime";
const DEFAULT_ORDER = ["dark", "light", "night"];

function getOrder(cfg) {
  const modes = cfg?.modes && Object.keys(cfg.modes);
  return Array.isArray(modes) && modes.length ? modes : DEFAULT_ORDER;
}
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
 * applyTheme: supports BOTH signatures
 * 1) applyTheme(themeConfig, mode)  // runtime CSS vars + data-theme
 * 2) applyTheme(mode)               // just set data-theme + persist
 */
export function applyTheme(themeOrConfig, maybeMode) {
  if (typeof document === "undefined") return;

  // Signature 2: applyTheme("dark" | "light" | "night")
  if (typeof themeOrConfig === "string" && !maybeMode) {
    const modeOnly = themeOrConfig || "dark";
    document.documentElement.setAttribute("data-theme", modeOnly);
    try { localStorage.setItem("theme", modeOnly); } catch {}
    return modeOnly;
  }

  // Signature 1: applyTheme(themeConfig, mode)
  const themeConfig = themeOrConfig || {};
  const modes = themeConfig?.modes || {};
  const order = getOrder(themeConfig);

  let mode = maybeMode;
  if (!mode) {
    try {
      const stored = localStorage.getItem("theme");
      if (stored && (modes[stored] || DEFAULT_ORDER.includes(stored))) mode = stored;
    } catch {}
  }
  if (!mode) mode = order.find((m) => modes[m]) || "dark";

  const vars = modes[mode] || {};
  const css = varsToCss(vars);
  const el = ensureRuntimeStyleEl();
  if (el) el.textContent = css;

  document.documentElement.setAttribute("data-theme", mode);
  try { localStorage.setItem("theme", mode); } catch {}
  return mode;
}

export function nextMode(themeConfig, current) {
  const order = getOrder(themeConfig);
  const i = order.indexOf(current);
  const from = i >= 0 ? i : 0;
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(from + step) % order.length];
    if (!themeConfig?.modes || themeConfig.modes[candidate]) return candidate;
  }
  return "dark";
}

export function initTheme(themeConfig, preferred) {
  let initial = preferred || "dark";
  try {
    const stored = localStorage.getItem("theme");
    if (stored && (themeConfig?.modes?.[stored] || DEFAULT_ORDER.includes(stored))) {
      initial = stored;
    }
  } catch {}
  applyTheme(themeConfig, initial);
}

/* 🔌 Expose globals for legacy calls that don't import it */
if (typeof window !== "undefined") {
  // only set if not already present
  if (!("applyTheme" in window)) window.applyTheme = applyTheme;
  if (!("nextMode" in window)) window.nextMode = nextMode;
}
