// src/theme/applyTheme.js

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const parts = h.length === 3
    ? [h[0]+h[0], h[1]+h[1], h[2]+h[2]]
    : [h.slice(0,2), h.slice(2,4), h.slice(4,6)];
  const [r,g,b] = parts.map(v => parseInt(v, 16));
  return { r, g, b };
}
function rgbToHslTriplet({ r, g, b }) {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`;
}
function toHslTriplet(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (s.startsWith("#")) return rgbToHslTriplet(hexToRgb(s));
  if (/^hsl\(/i.test(s)) {
    const m = s.match(/hsl\(\s*([0-9.]+)[,\s]+([0-9.]+)%[,\s]+([0-9.]+)%/i);
    return m ? `${m[1]} ${m[2]}% ${m[3]}%` : null;
  }
  if (/^[0-9.]+\s+[0-9.]+%\s+[0-9.]+%$/.test(s)) return s; // already triplet
  return null;
}
function contrast(darkLike, hslTriplet) {
  // super simple: if L > 55 use dark text, else near-white text
  if (!hslTriplet) return darkLike ? "0 0% 98%" : "0 0% 10%";
  const m = hslTriplet.match(/[0-9.]+%\s*$/);
  const l = m ? parseFloat(m[0]) : 50;
  return l > 55 ? "0 0% 10%" : "0 0% 98%";
}

export function applyTheme(themeConfig, mode) {
  const root = document.documentElement;

  // data-theme + dark class (DaisyUI + Tailwind dark variant)
  root.setAttribute("data-theme", mode);
  document.body?.setAttribute("data-theme", mode);
  const darkLike = mode === "dark" || mode === "night";
  root.classList.toggle("dark", darkLike);
  root.style.colorScheme = darkLike ? "dark" : "light";

  // tokens for this mode
  const t = themeConfig?.modes?.[mode] || {};

  // map your token names -> palette inputs
  const src = {
    background: t["--bg"]        ?? t["--background"],
    surface:    t["--surface"]   ?? t["--card"],
    panel:      t["--panel"]     ?? t["--popover"],
    text:       t["--text"]      ?? t["--foreground"],
    muted:      t["--muted"],
    border:     t["--border"],
    ring:       t["--ring"],
    primary:    t["--primary"],
    secondary:  t["--secondary"],
    accent:     t["--accent"],
  };

  const hsl = {};
  for (const [k, v] of Object.entries(src)) hsl[k] = toHslTriplet(v);

  // sensible defaults if something is missing
  hsl.background ||= darkLike ? "222.2 47.4% 11.2%" : "0 0% 100%";
  hsl.surface    ||= hsl.background;
  hsl.panel      ||= hsl.surface;
  hsl.text       ||= darkLike ? "210 40% 98%" : "222.2 84% 4.9%";
  hsl.muted      ||= darkLike ? "215 16% 27%" : "215 16% 84%";
  hsl.border     ||= darkLike ? "0 0% 20%" : "0 0% 86%";
  hsl.ring       ||= hsl.primary || "217.2 91.2% 59.8%";
  hsl.primary    ||= "217.2 91.2% 59.8%";
  hsl.secondary  ||= "174 63% 40%";
  hsl.accent     ||= "330 81% 60%";

  // derive foregrounds by (very) rough contrast
  const fg = {
    background: contrast(darkLike, hsl.background),
    card:       contrast(darkLike, hsl.surface),
    popover:    contrast(darkLike, hsl.panel),
    primary:    contrast(darkLike, hsl.primary),
    secondary:  contrast(darkLike, hsl.secondary),
    accent:     contrast(darkLike, hsl.accent),
    muted:      contrast(darkLike, hsl.muted),
    destructive: "0 0% 98%",
  };

  // Tailwind palette vars (HSL triplets, no hsl() wrapper)
  const set = (k, v) => root.style.setProperty(k, v);
  set("--background", hsl.background);
  set("--foreground", fg.background);
  set("--card", hsl.surface);
  set("--card-foreground", fg.card);
  set("--popover", hsl.panel);
  set("--popover-foreground", fg.popover);
  set("--muted", hsl.muted);
  set("--muted-foreground", fg.muted);
  set("--border", hsl.border);
  set("--input", hsl.border);
  set("--ring", hsl.ring);
  set("--primary", hsl.primary);
  set("--primary-foreground", fg.primary);
  set("--secondary", hsl.secondary);
  set("--secondary-foreground", fg.secondary);
  set("--accent", hsl.accent);
  set("--accent-foreground", fg.accent);
  set("--destructive", "0 84% 60%");
  set("--destructive-foreground", fg.destructive);

  // also keep your original custom tokens
  for (const [k, v] of Object.entries(t)) {
    if (k.startsWith("--")) root.style.setProperty(k, v);
  }
}
