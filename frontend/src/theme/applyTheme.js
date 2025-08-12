// src/theme/applyTheme.js
// Single source of truth for runtime theme application.
// - Applies ONLY the selected mode's variables
// - Injects/updates a <style id="gg-theme-runtime"> so CSS wins immediately
// - Also sets <html data-theme="..."> for your CSS tokens to key on

const RUNTIME_STYLE_ID = "gg-theme-runtime";
const DEFAULT_ORDER = ["light", "dark", "night"];

/** Return the order of modes we should cycle through */
function getOrder(cfg) {
  const modes = cfg?.modes && Object.keys(cfg.modes);
  return Array.isArray(modes) && modes.length ? modes : DEFAULT_ORDER;
}

/** Build CSS text from a variables map: { "--bg": "#000", ... } */
function varsToCss(vars = {}) {
  const lines = [":root{"]; // deliberately unscoped so it overrides per mode
  for (const [k, v] of Object.entries(vars)) {
    if (!String(k).startsWith("--")) continue;
    lines.push(`${k}:${v};`);
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
 * @param {object} themeConfig - { modes: { light: { --bg:..., ... }, dark: {...}, ... } }
 * @param {string} mode - "light" | "dark" | "night"
 */
export function applyTheme(themeConfig, mode) {
  if (typeof document === "undefined") return;

  const modes = themeConfig?.modes || {};
  const vars = modes[mode] || {};
  const css = varsToCss(vars);

  const el = ensureRuntimeStyleEl();
  if (el) el.textContent = css;

  // Keep attribute for CSS that keys off data-theme
  document.documentElement.setAttribute("data-theme", mode);
  document.body?.setAttribute?.("data-theme", mode);
}

/** Decide the next mode to cycle to */
export function nextMode(themeConfig, current) {
  const order = getOrder(themeConfig);
  const i = Math.max(0, order.indexOf(current));
  return order[(i + 1) % order.length];
}
