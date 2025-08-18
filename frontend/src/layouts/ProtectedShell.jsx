// src/layouts/ProtectedShell.jsx
import React from "react";
import { Outlet, useLocation, Link, useNavigate } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";

/**
 * Props (optional):
 * - title?: string
 * - primaryAction?: { label: string, onClick: () => void, icon?: ReactNode }
 */
export default function ProtectedShell({ title, primaryAction }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false); // desktop mini sidebar
  const [cmdOpen, setCmdOpen] = React.useState(false); // command palette

  React.useEffect(() => { setMobileOpen(false); }, [pathname]);

  // keyboard: ⌘K / Ctrl+K for command palette
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

  // theme toggle (simple: toggles data-theme between dark/light)
  const toggleTheme = React.useCallback(() => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") || "dark";
    root.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  }, []);

  const headerTitle = title || "GeniusGrid";

  // Breadcrumbs from URL (no API calls)
  const crumbs = React.useMemo(() => {
    // /app/admin/org -> ["Admin", "Org"]
    const segs = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean);
    const start = segs[0] === "app" ? 1 : 0;
    const pretty = (s) => {
      const map = {
        admin: "Admin",
        crm: "CRM",
        leads: "Leads",
        companies: "Companies",
        contacts: "Contacts",
        deals: "Deals",
        reports: "Reports",
        org: "Organization",
        branding: "Branding",
        localization: "Localization",
        calendars: "Calendars",
        api: "API",
      };
      if (map[s]) return map[s];
      return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const parts = segs.slice(start);
    let acc = segs.slice(0, start).join("/");
    const built = [];
    parts.forEach((p) => {
      acc += `/${p}`;
      built.push({ label: pretty(p), to: `/${acc}`.replace(/\/+/g, "/") });
    });
    return built;
  }, [pathname]);

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    navigate("/", { replace: true });
    window.location.reload();
  }

  return (
    <div
  className="min-h-screen bg-base-200 text-base-content"
  style={{ "--sbw": collapsed ? "4rem" : "16rem" }} // 4rem = w-16, 16rem = w-64
>

      {/* Skip link for a11y */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-base-100 border border-base-300 rounded px-3 py-1 z-[100]"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (collapsible) */}
     <aside
  className={`fixed left-0 top-0 h-screen ${collapsed ? "w-16" : "w-64"} z-40 border-r border-base-300 bg-base-100`}
  aria-label="Sidebar"
>

        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      </aside>

      {/* Mobile drawer + overlay */}
      <div className={`md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        {/* Overlay above header/content */}
        <div
          className={`fixed inset-0 z-50 transition-opacity bg-black/40 backdrop-blur-sm ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
        {/* Drawer */}
        <div
          className={`fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-base-100 border-r border-base-300 transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
          role="dialog" aria-modal="true"
        >
          <AppSidebar onRequestClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Topbar */}
     <header
  role="banner"
  className="sticky top-0 z-40 bg-base-100/80 backdrop-blur border-b border-base-300 md:pl-[var(--sbw)]"
>

        <div className="h-14 px-2 sm:px-3 flex items-center gap-2">
          {/* Hamburger (mobile) */}
          <button
            className="md:hidden btn btn-ghost btn-square"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Desktop collapse toggle */}
          <button
            className="hidden md:inline-flex btn btn-ghost btn-square"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h4v16H3z" /><polyline points="13 6 18 12 13 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h4v16H3z" /><polyline points="18 6 13 12 18 18" />
              </svg>
            )}
          </button>

          {/* Brand */}
          <Link to="/app" className="flex items-center gap-2 min-w-0">
            <img src="/images/company-logo.png" alt="Logo" className="w-7 h-7 rounded" draggable="false" />
            <span className="hidden sm:inline font-semibold truncate">{headerTitle}</span>
            {/* Env badge (optional) */}
            {import.meta.env.MODE !== "production" && (
              <span className="hidden md:inline badge badge-outline ml-1">{import.meta.env.MODE}</span>
            )}
          </Link>

          {/* Breadcrumbs (md+) */}
          <nav className="hidden md:flex items-center gap-1 text-sm text-base-content/70 ml-2" aria-label="Breadcrumb">
            <Link className="hover:link" to="/app">Home</Link>
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

          <div className="flex-1" />

          {/* Global Search / Command */}
          <div className="hidden md:flex items-center">
            <button
              className="btn btn-sm btn-ghost gap-2"
              onClick={() => setCmdOpen(true)}
              aria-label="Open global search"
              title="Search (Ctrl/⌘+K)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="hidden lg:inline">Search</span>
              <kbd className="kbd kbd-xs hidden lg:inline">⌘K</kbd>
            </button>
          </div>
          {/* Mobile Search icon */}
          <button
            className="md:hidden btn btn-ghost btn-square"
            aria-label="Search"
            onClick={() => setCmdOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Primary action — always visible, compact on small screens */}
          {primaryAction && (
            <button
              className="btn btn-primary btn-sm md:btn gap-2"
              onClick={primaryAction.onClick}
            >
              {/* Plus icon */}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="sm:inline">{primaryAction.label}</span>
            </button>
          )}

          {/* Theme toggle */}
          <button className="btn btn-ghost btn-square" aria-label="Toggle theme" onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          {/* Notifications */}
          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost btn-square" aria-label="Notifications">
              <div className="indicator">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {/* badge placeholder */}
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
              <span className="text-lg leading-none">?</span>
            </summary>
            <ul className="menu dropdown-content bg-base-100 rounded-box z-[60] mt-2 w-56 p-2 shadow">
              <li><a href="https://docs.example.com" target="_blank" rel="noreferrer">Documentation</a></li>
              <li><a href="mailto:support@example.com">Contact support</a></li>
              <li><button onClick={() => setCmdOpen(true)}>Search commands</button></li>
            </ul>
          </details>

          {/* User menu */}
          <details className="dropdown dropdown-end">
            <summary className="btn btn-ghost gap-2 h-10 px-2">
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content w-8 rounded-full">GG</div>
              </div>
              <span className="hidden sm:inline text-sm font-medium">You</span>
            </summary>
            <ul className="menu dropdown-content bg-base-100 rounded-box z-[60] mt-2 w-56 p-2 shadow">
              <li><Link to="/app/admin/users">Profile</Link></li>
              <li><Link to="/app/admin/settings">Settings</Link></li>
              <li><button onClick={onLogout}>Sign out</button></li>
            </ul>
          </details>
        </div>
      </header>

      {/* Main content area */}
    <main id="main" className="transition-[padding] duration-200 md:pl-[var(--sbw)]">
        <div className="mx-auto max-w-[1600px] p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Command Palette (very lightweight) */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 px-3"
          role="dialog" aria-modal="true" onClick={() => setCmdOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-base-100 border border-base-300 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                type="text"
                className="input input-ghost flex-1 h-10"
                placeholder="Search menus, pages, actions…"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setCmdOpen(false);
                  // hook up to your own global search later
                }}
              />
              <kbd className="kbd kbd-xs hidden md:inline">Esc</kbd>
            </div>
            <div className="p-3 text-sm opacity-70">
              Type to search… (hook into your menu/search API when ready)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
