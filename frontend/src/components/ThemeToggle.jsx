// src/components/ThemeToggle.jsx
import React, { useEffect, useState } from "react";

// Optional imports; component works even if these paths don't exist
let applyThemeLib = null;
let nextModeLib = null;
try {
  // eslint-disable-next-line import/no-unresolved
  const lib = await import("@/theme/applyTheme");
  applyThemeLib = lib.applyTheme || null;
  nextModeLib = lib.nextMode || null;
} catch {}

let uiApi = null;
try {
  // eslint-disable-next-line import/no-unresolved
  uiApi = (await import("@/api/ui")).uiApi || null;
} catch {}

const THEMES = ["light", "dark", "night"];
const LS_KEYS = ["gg.theme", "theme"]; // read both, write both for compat

const FALLBACK_THEME = {
  modes: {
    light: {
      "--bg":"#F7F8FA","--surface":"#FFFFFF","--panel":"#FFFFFF",
      "--text":"#0B1220","--muted":"#5B667A","--border":"rgba(15,23,42,.10)",
      "--primary":"#3B82F6","--ring":"rgba(59,130,246,.35)"
    },
    dark: {
      "--bg":"#0B0D10","--surface":"#0F1318","--panel":"#131822",
      "--text":"#E5E7EB","--muted":"#9AA5B1","--border":"rgba(255,255,255,.08)",
      "--primary":"#6E8BFF","--ring":"rgba(110,139,255,.35)"
    },
    night: {
      "--bg":"#05070B","--surface":"#0A0D12","--panel":"#0E1218",
      "--text":"#E6F0FF","--muted":"#90A0B3","--border":"rgba(150,170,200,.12)",
      "--primary":"#64D2FF","--ring":"rgba(100,210,255,.35)"
    }
  }
};

/* ---------------- helpers ---------------- */
function readSavedTheme() {
  for (const k of LS_KEYS) {
    const v = localStorage.getItem(k);
    if (v && THEMES.includes(v)) return v;
  }
  return null;
}
function saveTheme(mode) {
  for (const k of LS_KEYS) localStorage.setItem(k, mode);
}
function getDomTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  return THEMES.includes(t) ? t : null;
}
function setDomTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  document.body?.setAttribute?.("data-theme", mode);
}
function safeNextMode(themeCfg, current) {
  if (typeof nextModeLib === "function") return nextModeLib(themeCfg, current);
  const order = Object.keys(themeCfg?.modes || {}).length
    ? Object.keys(themeCfg.modes)
    : THEMES;
  const i = Math.max(0, order.indexOf(current));
  return order[(i + 1) % order.length];
}
function safeApplyTheme(themeCfg, mode) {
  // Prefer your library applyTheme(cfg, mode)
  if (typeof applyThemeLib === "function") {
    try { applyThemeLib(themeCfg, mode); } catch {}
  }
  // Always set the attribute so CSS tokens take effect
  setDomTheme(mode);
  saveTheme(mode);
}

/* ---------------- component ---------------- */
export default function ThemeToggle() {
  // Determine initial mode: user saved → DOM → OS → 'light'
  const initial =
    readSavedTheme() ||
    getDomTheme() ||
    (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light");

  const [mode, setMode] = useState(initial);
  const [themeCfg, setThemeCfg] = useState(null);

  // On mount: load theme config (window.__GG_THEME → API → fallback) and apply current mode
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg =
          window.__GG_THEME ||
          (uiApi && typeof uiApi.getTheme === "function" ? await uiApi.getTheme() : null) ||
          FALLBACK_THEME;
        if (!alive) return;
        setThemeCfg(cfg);
        safeApplyTheme(cfg, mode);
      } catch {
        if (!alive) return;
        setThemeCfg(FALLBACK_THEME);
        safeApplyTheme(FALLBACK_THEME, mode);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // Keep label in sync if something external changes <html data-theme>
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const dom = getDomTheme();
      if (dom && dom !== mode) setMode(dom);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [mode]);

  const cycle = () => {
    const cfg = themeCfg || FALLBACK_THEME;
    const current = getDomTheme() || mode;
    const next = safeNextMode(cfg, current);
    setMode(next);
    safeApplyTheme(cfg, next);

    // best-effort notify server (non-blocking)
    const payload = { theme: next };
    if (uiApi?.setTheme) {
      try { uiApi.setTheme(payload); } catch {}
    } else {
      try {
        fetch(`${import.meta.env?.VITE_UI_API_BASE || ""}/ui/theme`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch {}
    }
  };

  const label = mode === "light" ? "☀️ Light" : mode === "dark" ? "🌙 Dark" : "🌌 Night";

  return (
    <button className="gg-btn gg-btn-ghost h-9 px-3" onClick={cycle} title="Switch theme">
      {label}
    </button>
  );
}
