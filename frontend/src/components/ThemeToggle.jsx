// src/components/ThemeToggle.jsx
import { useEffect, useState } from "react";
import { applyTheme, nextMode as libNextMode } from "@/theme/applyTheme";
import { uiApi } from "@/api/ui";

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

function safeNextMode(theme, current) {
  if (typeof libNextMode === "function") return libNextMode(theme, current);
  const order = Object.keys(theme?.modes || {}).length
    ? Object.keys(theme.modes)
    : ["dark", "light", "night"]; // prefer dark-first cycle
  const idx = Math.max(0, order.indexOf(current));
  return order[(idx + 1) % order.length];
}

const VALID = new Set(["dark", "light", "night"]);

export default function ThemeToggle() {
  // Force dark as the initial visual state unless user explicitly saved a value.
  const initial = (() => {
    try {
      if (typeof window !== "undefined") {
        const ls = localStorage.getItem("theme");
        if (ls && VALID.has(ls)) return ls;
        const dom = document.documentElement.getAttribute("data-theme");
        if (dom && VALID.has(dom)) return dom;
      }
    } catch {}
    return "dark";
  })();

  const [mode, setMode] = useState(initial);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Decide desired mode ONCE: if nothing saved, default to dark (your requirement)
      let desired = "dark";
      try {
        const saved = localStorage.getItem("theme");
        if (saved && VALID.has(saved)) desired = saved;
      } catch {}

      // Load tokens (server → fallback) WITHOUT overriding desired
      let cfg = null;
      try {
        cfg = window.__GG_THEME || (await uiApi.getTheme()) || FALLBACK_THEME;
      } catch {
        cfg = FALLBACK_THEME;
      }
      if (!alive) return;

      setTheme(cfg);

      // Apply chosen mode firmly
      try {
        applyTheme(cfg, desired);
      } catch {
        // fallback: still ensure data-theme is set
        document.documentElement.setAttribute("data-theme", desired);
      }
      document.documentElement.setAttribute("data-theme", desired);
      try { localStorage.setItem("theme", desired); } catch {}

      // Keep state in sync so the label is correct
      setMode(desired);
    })();

    return () => { alive = false; };
    // mount once only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycle = () => {
    const cfg = theme || FALLBACK_THEME;
    const next = safeNextMode(cfg, mode);
    setMode(next);
    applyTheme(cfg, next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
    uiApi?.setTheme?.({ theme: next }); // fire-and-forget
  };

  const label =
    mode === "light"
      ? "☀️ Light"
      : mode === "dark"
      ? "🌌 Dark"
      : "🌙 Night";

  return (
    <button
      className="gg-btn gg-btn-ghost h-9 px-3"
      onClick={cycle}
      title={`Switch theme (current: ${label.replace(/^[^ ]+ /, "")})`}
      aria-pressed="true"
    >
      {label}
    </button>
  );
}
