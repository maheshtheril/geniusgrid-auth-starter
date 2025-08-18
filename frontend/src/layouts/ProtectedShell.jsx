// src/layouts/ProtectedShell.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";

const LS_COLLAPSED = "gg:sidebar:collapsed:v1";

// viewport ≥ 640 hook (don’t rely on Tailwind config)
function useAtLeastSm() {
  const [ok, setOk] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = (e) => setOk(e.matches);
    mql.addEventListener?.("change", onChange) ?? mql.addListener(onChange);
    return () => mql.removeEventListener?.("change", onChange) ?? mql.removeListener(onChange);
  }, []);
  return ok;
}

export default function ProtectedShell({ title, primaryAction }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_COLLAPSED) === "1"; } catch { return false; }
  });
  const isAtLeastSm = useAtLeastSm();
  const { pathname } = useLocation();

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const headerTitle = useMemo(() => title || "GeniusGrid", [title]);

  // widths/padding based on collapse state (desktop only)
  const asideWidth = collapsed ? "w-16" : "w-64";
  const mainPad    = collapsed ? "pl-16" : "pl-64";

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      {/* Desktop sidebar (visible when ≥640px) */}
      {isAtLeastSm && (
        <aside
          aria-label="Sidebar"
          className={`fixed left-0 top-0 h-screen ${asideWidth} z-40 border-r border-base-300 bg-base-100 transition-[width] duration-200`}
        >
          <AppSidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
          />
        </aside>
      )}

      {/* Mobile drawer + overlay (only <640px) */}
      {!isAtLeastSm && (
        <div className={`${mobileOpen ? "" : "pointer-events-none"}`}>
          <div
            className={`fixed inset-0 z-50 transition-opacity bg-black/40 backdrop-blur-sm ${mobileOpen ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className={`fixed left-0 top-0 bottom-0 z-50 w-72 max-w-[85vw] bg-base-100 border-r border-base-300 transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
            role="dialog" aria-modal="true"
          >
            <AppSidebar
              collapsed={false}
              onRequestClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-base-100/80 backdrop-blur border-b border-base-300">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14">
          {/* Left controls: mobile hamburger OR desktop collapse toggle */}
          {!isAtLeastSm ? (
            <button
              className="btn btn-ghost btn-square"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              {/* hamburger */}
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-square"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {/* sidebar collapse icon (two states) */}
              {collapsed ? (
                // expand → right chevron into panel
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h4v16H3z" />
                  <polyline points="13 6 18 12 13 18" />
                </svg>
              ) : (
                // collapse → left chevron out of panel
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h4v16H3z" />
                  <polyline points="18 6 13 12 18 18" />
                </svg>
              )}
            </button>
          )}

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">{headerTitle}</h1>
          </div>

          {/* Primary action */}
          {primaryAction && (
            <button
              className="btn btn-primary btn-sm sm:btn"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      </header>

      {/* Main content area */}
      <main className={isAtLeastSm ? mainPad : ""}>
        <div className="mx-auto max-w-[1600px] p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
