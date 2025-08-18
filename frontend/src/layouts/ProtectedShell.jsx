import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";
import Topbar from "@/components/layout/Topbar";

export default function ProtectedShell({ title = "GeniusGrid", primaryAction }) {
  const { pathname } = useLocation();

  // Mobile drawer + desktop collapse
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  // Close mobile drawer when route changes
  React.useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    // Keep header & main aligned with sidebar using --sbw
    <div
      className="min-h-screen bg-base-200 text-base-content"
      style={{ "--sbw": collapsed ? "4rem" : "16rem" }} // 4rem = w-16, 16rem = w-64
    >
      {/* Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-base-100 border border-base-300 rounded px-3 py-1 z-[100]"
      >
        Skip to content
      </a>

      {/* Always render the desktop sidebar so it cannot 'disappear' */}
      <aside
        aria-label="Sidebar"
        data-sb="true"
        className={`fixed left-0 top-0 h-screen ${collapsed ? "w-16" : "w-64"} z-40 border-r border-base-300 bg-base-100 overflow-y-auto`}
      >
        <AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)} />
      </aside>

      {/* Mobile drawer + overlay (optional; keep for phones) */}
      <div className={`md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div
          className={`fixed inset-0 z-50 transition-opacity bg-black/40 backdrop-blur-sm ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-base-100 border-r border-base-300 transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
          role="dialog" aria-modal="true"
        >
          <AppSidebar onRequestClose={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Topbar (aligned to sidebar via md:pl-[var(--sbw)] inside Topbar) */}
      <Topbar
        onBurger={() => setMobileOpen(true)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        title={title}
        primaryAction={primaryAction}
      />

      {/* Main content aligned with sidebar */}
      <main id="main" className="transition-[padding] duration-200 md:pl-[var(--sbw)]">
        <div className="mx-auto max-w-[1600px] p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
