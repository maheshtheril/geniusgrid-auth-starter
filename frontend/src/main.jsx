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

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
