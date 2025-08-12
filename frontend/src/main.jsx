import "./index.css";
import "./styles/theme.css";
import "./styles.css";         // frame styles using those tokens
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

// Prove JS executed
if (window.__panicOk) window.__panicOk("main.jsx loaded");

const root = document.getElementById("root");
if (root) {
  // Show immediate marker before React mounts
  root.innerHTML = '<div style="padding:8px;background:#065f46;">JS OK: React mounting…</div>';
}
// Apply saved/system theme before the app paints
(() => {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");
  const html = document.documentElement;
  html.setAttribute("data-theme", initial);
  document.body.setAttribute("data-theme", initial);
  html.classList.toggle("dark", initial !== "light");
})();

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
