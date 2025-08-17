// src/main.jsx
import "./styles/theme-runtime.css";
import "./styles.css";
import "@/styles/sidebar.css";
import "./styles/tokens.css";
import "@/styles/responsive-globals.css";


import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

// ✅ Static, safe import (no early calls)
import { applyTheme } from "@/theme/applyTheme";
import "./styles/light-overrides.css";
import { installAiProspectMock } from "./mocks/installAiProspectMock";

installAiProspectMock();
// Optional deps — app still boots if these fail to import
let uiApi = null;
try {
  uiApi = (await import("@/api/ui")).uiApi || null;
} catch {}

// Fallback theme tokens (light/dark/night)
const FALLBACK_THEME = {
  modes: {
    light: {
      "--bg": "#F7F8FA",
      "--surface": "#FFFFFF",
      "--panel": "#FFFFFF",
      "--text": "#0B1220",
      "--muted": "#5B667A",
      "--border": "rgba(15,23,42,.1)",
      "--primary": "#3B82F6",
      "--ring": "rgba(59,130,246,.35)",
    },
    dark: {
      "--bg": "#0B0D10",
      "--surface": "#0F1318",
      "--panel": "#131822",
      "--text": "#E5E7EB",
      "--muted": "#9AA5B1",
      "--border": "rgba(255,255,255,.08)",
      "--primary": "#6E8BFF",
      "--ring": "rgba(110,139,255,.35)",
    },
    night: {
      "--bg": "#05070B",
      "--surface": "#0A0D12",
      "--panel": "#0E1218",
      "--text": "#E6F0FF",
      "--muted": "#90A0B3",
      "--border": "rgba(150,170,200,.12)",
      "--primary": "#64D2FF",
      "--ring": "rgba(100,210,255,.35)",
    },
  },
};

// Theme order & storage keys
const THEMES = ["dark", "light", "night"]; // default cycle: dark → light → night
const LS_KEYS = ["gg.theme", "theme"]; // read/write both for compatibility

function readSavedMode() {
  for (const k of LS_KEYS) {
    const v = safeGetLS(k);
    if (v && THEMES.includes(v)) return v;
  }
  return null;
}
function saveMode(mode) {
  for (const k of LS_KEYS) safeSetLS(k, mode);
}
function safeGetLS(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSetLS(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function applyDomMode(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  if (document.body) document.body.setAttribute("data-theme", mode);
}
// Default to dark unless user explicitly saved something
function chooseInitialMode() {
  const saved = readSavedMode();
  if (saved) return saved;
  return "dark";
}

const rootEl = document.getElementById("root");

(async () => {
  // === 1) Decide & apply mode IMMEDIATELY to avoid flash ===
  const initialMode = chooseInitialMode();
  applyDomMode(initialMode);
  saveMode(initialMode); // persist earliest decision

  // === 2) Load theme tokens (server → fallback) WITHOUT changing mode ===
  let themeConfig = null;
  try {
    themeConfig =
      (uiApi && typeof uiApi.getTheme === "function" && (await uiApi.getTheme())) ||
      FALLBACK_THEME;
  } catch {
    themeConfig = FALLBACK_THEME;
  }

  // Expose tokens for ThemeToggle (if it wants to reuse them)
  window.__GG_THEME = themeConfig;

  // Apply tokens for the already-chosen mode (don’t override mode)
  try {
    if (typeof applyTheme === "function") {
      applyTheme(themeConfig, initialMode);
    }
  } catch {
    // Silently ignore token application errors; data-theme still controls CSS variables.
  }

  // === 2.5) Try to load EntitlementsProvider; fallback to Fragment if unavailable ===
  let EntitlementsProvider = React.Fragment;
  try {
    const mod = await import("./context/EntitlementsContext.jsx");
    EntitlementsProvider = mod.EntitlementsProvider || React.Fragment;
  } catch {}

  // === 3) Mount the app ===
  if (!rootEl) throw new Error("Root element #root not found");

  createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <EntitlementsProvider>
          <App />
        </EntitlementsProvider>
      </BrowserRouter>
    </React.StrictMode>
  );

  // === 4) Cross-tab sync: if another tab changes theme, reflect it here ===
  window.addEventListener("storage", () => {
    const next = readSavedMode();
    if (next && THEMES.includes(next)) {
      applyDomMode(next);
      try {
        if (typeof applyTheme === "function") {
          applyTheme(window.__GG_THEME || FALLBACK_THEME, next);
        }
      } catch {}
    }
  });
})();
