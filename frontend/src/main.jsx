// src/main.jsx
import "./styles/theme-runtime.css";
import "./styles.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

import { uiApi } from "@/api/ui";
import { applyTheme } from "@/theme/applyTheme";

const root = document.getElementById("root");

(async () => {
  // 1) Decide initial mode (no `.dark` class toggling — we only use data-theme + CSS vars)
  const savedMode = localStorage.getItem("theme") || "dark";

  try {
    // Load server-driven theme (tokens per mode)
    const themeConfig = await uiApi.getTheme();
    applyTheme(themeConfig, savedMode);
    // expose for ThemeToggle if you need it
    window.__GG_THEME = themeConfig;
  } catch {
    // Fallback tokens (light/dark/night)
    const fallback = {
      modes: {
        light: {
          "--bg":"#F7F8FA","--surface":"#FFFFFF","--panel":"#FFFFFF",
          "--text":"#0B1220","--muted":"#5B667A","--border":"rgba(15,23,42,.1)",
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
    applyTheme(fallback, savedMode);
    window.__GG_THEME = fallback;
  }

  // Ensure the chosen mode is reflected on both html & body (no class toggles)
  document.documentElement.setAttribute("data-theme", savedMode);
  document.body.setAttribute("data-theme", savedMode);

  // 2) Mount the app
  if (!root) {
    throw new Error("Root element #root not found");
  }

  createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
})();
