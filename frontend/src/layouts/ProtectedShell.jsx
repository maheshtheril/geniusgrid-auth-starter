// src/layouts/ProtectedShell.jsx
import React, { useState, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";

/**
 * Props (optional):
 * - title?: string
 * - primaryAction?: { label: string, onClick: () => void }
 */
export default function ProtectedShell({ title, primaryAction }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // Close mobile drawer on route change
  React.useEffect(() => { setMobileOpen(false); }, [pathname]);

  const headerTitle = useMemo(() => title || "GeniusGrid", [title]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      {/* Desktop sidebar (visible from sm and up) */}
      <aside
        className="hidden sm:block fixed left-0 top-0 h-screen w-64 z-40 border-r border-base-300 bg-base-100"
        aria-label="Sidebar"
      >
        <AppSidebar />
      </aside>

      {/* Mobile drawer + overlay (only below sm) */}
      <div className={`sm:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
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

      {/* Header */}
      <header className="sticky top-0 z-30 bg-base-100/80 backdrop-blur border-b border-base-300">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14">
          {/* Hamburger (mobile only) */}
          <button
            className="sm:hidden btn btn-ghost btn-square"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            {/* icon: 3 bars */}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">{headerTitle}</h1>
          </div>

          {/* Primary action – always visible, adapts to screen */}
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
      <main className="sm:pl-64">
        <div className="mx-auto max-w-[1600px] p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
