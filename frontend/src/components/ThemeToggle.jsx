// src/components/ThemeToggle.jsx
import { useEffect, useState } from "react";
const THEMES = ["light","dark","night"];

function applyTheme(t){
  const targets = [document.documentElement, document.body, document.getElementById("root")];
  document.documentElement.setAttribute("data-theme", t);
  document.body.setAttribute("data-theme", t);
  targets.forEach(el => el && el.classList.toggle("dark", t !== "light")); // ✅ boolean
  localStorage.setItem("theme", t);
}

export default function ThemeToggle(){
  const [theme,setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  useEffect(()=>{ applyTheme(theme); },[theme]);
  const cycle = () => setTheme(THEMES[(THEMES.indexOf(theme)+1)%THEMES.length]);
  return <button className="gg-btn gg-btn-ghost border border-[color:var(--border)]" onClick={cycle}>
    {theme === "light" ? "🌞 Light" : theme === "dark" ? "🌓 Dark" : "🌙 Night"}
  </button>;
}
