import "./index.css";
import "./styles/theme.css";   // CSS variables for light/dark/night
import "./styles.css";         // app frame using those variables

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

/* ---- Apply saved/system theme BEFORE React mounts (no FOUC) ---- */
(() => {
  const saved = localStorage.getItem("theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const initial = saved || (prefersDark ? "dark" : "light");

  const targets = [
    document.documentElement,
    document.body,
    document.getElementById("root"),
  ];

  document.documentElement.setAttribute("data-theme", initial);
  document.body.setAttribute("data-theme", initial);
  // Tailwind dark: variants should only be active when NOT light
  targets.forEach((el) => el && el.classList.toggle("dark", initial !== "light"));
})();

/* ---- Mount React ---- */
const rootEl =
  document.getElementById("root") ||
  (() => {
    const el = document.createElement("div");
    el.id = "root";
    document.body.appendChild(el);
    return el;
  })();

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
