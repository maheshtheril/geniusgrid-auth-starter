import './index.css';                       // ← must be first
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* inline fallback so you always see content even if Tailwind fails */}
    <div style={{ minHeight: "100vh", background: "#0B0D10", color: "#e5e7eb" }}>
      <App />
    </div>
  </React.StrictMode>
);
