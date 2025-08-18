// src/components/layout/Topbar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sun, Moon, Menu as MenuIcon, Search, Bell, HelpCircle,
  ChevronsLeft, ChevronsRight, Plus
} from "lucide-react";
import { useEnv } from "@/store/useEnv";

const THEME_KEY = "gg:theme";
const THEMES = ["light", "dark", "night"]; // add/remove to match your daisyUI themes

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && THEMES.includes(saved)) return saved;
  } catch {}
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "light";
}

export default function Topbar({
  onBurger,
  collapsed = false,
  onToggleCollapse,
  title = "GeniusGrid",
  primaryAction, // {label, onClick, icon?}
}) {
  const { user } = useEnv() || {};
  const { pathname } = useLocation();

  const [theme, setTheme] = React.useState(getInitialTheme());
  const [cmdOpen, setCmdOpen] = React.useState(false);

  // Apply + persist theme for daisyUI
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  // ⌘K / Ctrl+K opens command palette
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = React.useMemo(() => {
    const segs = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
    const start = segs[0] === "app" ? 1 : 0;
    const pretty = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const parts = segs.slice(start);
    let acc = segs.slice(0, start).join("/");
    const out = [];
    parts.forEach((p) => {
      acc += `/${p}`;
      out.push({ label: pretty(p), to: `/${acc}`.replace(/\/+/g, "/") });
    });
    return out;
  }, [pathname]);

  return (
    <>
      {/* Note: header aligns with sidebar using md:pl-[var(--sbw)] */}
      <header
        className="h-14 sticky top-0 z-40 bg-base-100/80 backdrop-blur border-b border-base-300 pl-0 md:pl-[var(--sbw)]"
        role="banner"
      >
        <div className="h-14 px-2 sm:px-3 flex items-center gap-2">
          {/* Mobile burger */}
          <button
            className="md:hidden btn btn-ghost btn-square"
            aria-label="Open menu"
            onClick={onBurger}
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              className="hidden md:inline-flex btn btn-ghost btn-square"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggleCollapse}
            >
              {collapsed ? <ChevronsRight className="w-5 h-5" /> : <ChevronsLeft className="w-5 h-5" />}
            </button>
          )}

          {/* Brand */}
          <Link to="/app" className="flex items-center gap-2 min-w-0">
            <img
              src="/images/company-logo.png"
              alt="Logo"
              className="w-7 h-7 rounded"
              draggable="false"
            />
            <span className="hidden sm:inline font-semibold truncate">{title}</span>
            {import.meta.env.MODE !== "production" && (
              <span className="hidden md:inline badge badge-outline ml-1">
                {import.meta.env.MODE}
              </span>
            )}
          </Link>

          {/* Breadcrumbs (md+) */}
          <nav
            aria-label="Breadcrumb"
            className="hidden md:flex items-center gap-1 text-sm text-base-content/70 ml-2"
          >
            <Link to="/app" className="hover:link">Home</Link>
            {crumbs.map((c, i) => (
              <React.Fragment key={c.to}>
                <span className="opacity-50">/</span>
                {i < crumbs.length - 1 ? (
                  <Link to={c.to} className="hover:link">{c.label}</Link>
                ) : (
                  <span className="font-medium text-base-content">{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Grow */}
          <div className="flex-1" />

          {/* Search / Command */}
          <button
            className="hidden md:inline-flex btn btn-sm btn-ghost gap-2"
            onClick={() => setCmdOpen(true)}
            aria-label="Open global search"
            title="Search (Ctrl/⌘+K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="kbd kbd-xs hidden lg:inline">⌘K</kbd>
          </button>
          <button
            className="md:hidden btn btn-ghost btn-square"
            aria-label="Search"
            onClick={() => setCmdOpen(true)}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Primary action */}
          {primaryAction && (
            <button
              className="btn btn-primary btn-sm md:btn gap-2"
              onClick={primaryAction.onClick}
              aria-label={primaryAction.label}
              title={primaryAction.label}
            >
              {primaryAction.icon || <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">{primaryAction.label}</span>
            </button>
          )}

          {/* Theme toggle */}
          <button
            className="btn btn-ghost btn-square"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme((t) => {
                const idx = THEMES.indexOf(t);
                return THEMES[(idx + 1) % THEMES.length] || "light";
              })
            }
            title="Toggle theme"
          >
            {theme === "dark" || theme === "night" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost btn-square" aria-label="Notifications">
              <div className="indicator">
                <Bell className="w-5 h-5" />
                {/* <span className="badge badge-xs badge-primary indicator-item" /> */}
              </div>
            </summary>
            <ul className="menu dropdown-content bg-base-100 rounded-box z-[60] mt-2 w-64 p-2 shadow">
              <li className="menu-title"><span>Notifications</span></li>
              <li><span className="opacity-70">No new notifications</span></li>
            </ul>
          </details>

          {/* Help */}
          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost btn-square" aria-label="Help">
              <HelpCircle className="w-5 h-5" />
            </summary>
            <ul className="menu dropdown-content bg-base-100 rounded-box z-[60] mt-2 w-56 p-2 shadow">
              <li><a href="https://docs.example.com" target="_blank" rel="noreferrer">Documentation</a></li>
              <li><a href="mailto:support@example.com">Contact support</a></li>
              <li><button onClick={() => setCmdOpen(true)}>Search commands</button></li>
            </ul>
          </details>

          {/* User */}
          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost gap-2 h-10 px-2">
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content w-8 rounded-full">
                  {(user?.email?.[0] || "G").toUpperCase()}
                </div>
              </div>
              <span className="hidden sm:inline text-sm font-medium truncate max-w-[160px]">
                {user?.email || "You"}
              </span>
            </summary>
            <ul className="menu dropdown-content bg-base-100 rounded-box z-[60] mt-2 w-56 p-2 shadow">
              <li><Link to="/app/admin/users">Profile</Link></li>
              <li><Link to="/app/admin/settings">Settings</Link></li>
              <li><a href="/api/auth/logout">Sign out</a></li>
            </ul>
          </details>
        </div>
      </header>

      {/* Command Palette */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 px-3"
          role="dialog" aria-modal="true"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-base-100 border border-base-300 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300">
              <Search className="w-4 h-4" />
              <input
                autoFocus
                type="text"
                className="input input-ghost flex-1 h-10"
                placeholder="Search menus, pages, actions…"
                onKeyDown={(e) => { if (e.key === "Escape") setCmdOpen(false); }}
              />
              <kbd className="kbd kbd-xs hidden md:inline">Esc</kbd>
            </div>
            <div className="p-3 text-sm opacity-70">
              Type to search… (wire into your menu list or API)
            </div>
          </div>
        </div>
      )}
    </>
  );
}
