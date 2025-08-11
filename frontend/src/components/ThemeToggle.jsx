import { useEffect, useState } from "react";

const THEMES = ["dark","night"];

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const next = () => setTheme(t => (t === "dark" ? "night" : "dark"));

  return (
    <button onClick={next} title={`Switch to ${theme==='dark'?'night':'dark'} theme`}
      className="gg-btn gg-btn-ghost border border-[color:var(--border)]">
      {theme === "dark" ? "🌙 Night" : "🌓 Dark"}
    </button>
  );
}
