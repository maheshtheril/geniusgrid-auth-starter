// src/layouts/ProtectedShell.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";

// tiny hook: is viewport at least 640px?
function useAtLeastSm() {
  const [ok, setOk] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 640px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = (e) => setOk(e.matches);
    // modern browsers
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange); // legacy Safari
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return ok;
}

/**
 * Props (optional):
 * - title?: string
 * - primaryAction?: { label: string, onClick: () => void }
 */
export default function ProtectedShell({ title, primaryAction }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const isAtLeastSm = useAtLeastSm();

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const headerTitle = useMemo(() => title || "GeniusGrid", [title]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      {/* Fixed sidebar (rendered ONLY when >= 640px) */}
      {isAtLeastSm && (
        <aside
          aria-label="Sidebar"
          className="block fixed left-0 top-0 h-screen w-64 z-40 border-r border-base-300 bg-base-100"
        >
          <AppSidebar />
        </aside>
      )}

      {/* Mobile drawer + overlay (ONLY when < 640px) */}
      {!isAtLeastSm && (
        <div className={`${mobileOpen ? "" : "pointer-events-none"}`}>
          {/* Overlay */}
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
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-base-100/80 backdrop-blur border-b border-base-300">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14">
          {/* Hamburger (only shows when < 640px) */}
          {!isAtLeastSm && (
            <button
              className="btn btn-ghost btn-square"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
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
      <main className={isAtLeastSm ? "pl-64" : ""}>
        <div className="mx-auto max-w-[1600px] p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
