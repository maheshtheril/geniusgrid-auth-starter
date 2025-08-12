// applyTheme(themeJson, mode)
export function applyTheme(theme, mode) {
  if (!theme || !theme.modes) return;
  const m = mode && theme.modes[mode] ? mode : Object.keys(theme.modes)[0];
  const vars = theme.modes[m];

  const root = document.documentElement;
  root.setAttribute("data-theme", m);
  for (const [k,v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  localStorage.setItem("theme", m);
}

export function nextMode(theme, cur) {
  const modes = Object.keys(theme?.modes || {});
  if (!modes.length) return cur || "light";
  const i = Math.max(0, modes.indexOf(cur));
  return modes[(i+1)%modes.length];
}
