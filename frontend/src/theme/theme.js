// src/theme/theme.js
const THEME_KEY = "gg:theme";                 // persisted choice
export const THEME_ORDER = ["dark", "light", "night", "system"]; // cycle order

export function getSavedTheme() {
  try { return localStorage.getItem(THEME_KEY) || "dark"; } catch { return "dark"; }
}

export function prefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
}

export function applyTheme(next) {
  const root = document.documentElement;

  // DaisyUI theme
  if (next === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", next);
  }

  // Tailwind dark: support
  const darkLike = next === "dark" || next === "night" || (next === "system" && prefersDark());
  root.classList.toggle("dark", !!darkLike);

  // Native color-scheme hint
  root.style.colorScheme = darkLike ? "dark" : "light";

  try { localStorage.setItem(THEME_KEY, next); } catch {}
}

export function cycleTheme(current) {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length];
}

export function watchSystemTheme(cb) {
  const mm = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => cb();
  mm.addEventListener?.("change", handler);
  return () => mm.removeEventListener?.("change", handler);
}
