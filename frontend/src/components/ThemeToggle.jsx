// src/components/ThemeToggle.jsx
import { useEffect, useState } from "react";
import { applyTheme, nextMode as libNextMode } from "@/theme/applyTheme";
import { uiApi } from "@/api/ui";

// Fallback tokens if server theme not reachable
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
    : ["light","dark","night"];
  const idx = Math.max(0, order.indexOf(current));
  return order[(idx + 1) % order.length];
}

export default function ThemeToggle() {
  // initial mode from LS → DOM → default
  const initial =
    localStorage.getItem("theme") ||
    document.documentElement.getAttribute("data-theme") ||
    "dark";

  const [mode, setMode] = useState(initial);
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = window.__GG_THEME || (await uiApi.getTheme()) || FALLBACK_THEME;
        if (!alive) return;
        setTheme(cfg);
        applyTheme(cfg, mode);
      } catch {
        if (!alive) return;
        setTheme(FALLBACK_THEME);
        applyTheme(FALLBACK_THEME, mode);
      }
      document.documentElement.setAttribute("data-theme", mode);
      document.body.setAttribute("data-theme", mode);
      localStorage.setItem("theme", mode);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  const cycle = () => {
    const cfg = theme || FALLBACK_THEME;
    const next = safeNextMode(cfg, mode);
    setMode(next);
    applyTheme(cfg, next);
    document.documentElement.setAttribute("data-theme", next);
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);

    // best-effort server persist (non-blocking)
    uiApi?.setTheme?.({ theme: next });
  };

  const label = mode === "light" ? "☀️ Light" : mode === "dark" ? "🌙 Dark" : "🌌 Night";
  return (
    <button className="gg-btn gg-btn-ghost h-9 px-3" onClick={cycle} title="Switch theme">
      {label}
    </button>
  );
}
