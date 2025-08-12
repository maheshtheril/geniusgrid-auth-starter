import { useEffect, useState } from "react";

const THEMES = ["light", "dark", "night"];

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(t) {
  const html = document.documentElement;
  html.setAttribute("data-theme", t);       // DaisyUI + your CSS vars
  document.body.setAttribute("data-theme", t); // if some parts read from body
  html.classList.toggle("dark", t !== "light"); // Tailwind dark: variants
  localStorage.setItem("theme", t);
}

export default function ThemeToggle({ compact=false }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved || (systemPrefersDark() ? "dark" : "light");
  });

  useEffect(() => { applyTheme(theme); }, [theme]);

  const cycle = () => {
    const i = THEMES.indexOf(theme);
    setTheme(THEMES[(i + 1) % THEMES.length]);
  };

  const label =
    theme === "light" ? "🌞 Light" :
    theme === "dark"  ? "🌓 Dark"  :
                        "🌙 Night";

  return (
    <button
      onClick={cycle}
      className="gg-btn gg-btn-ghost border border-[color:var(--border)]"
      title={`Theme: ${theme}`}
    >
      {compact ? label.split(" ")[0] : label}
    </button>
  );
}
