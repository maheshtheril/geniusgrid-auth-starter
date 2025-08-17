// ---------- FILE: src/layouts/ProtectedShell.jsx ----------
import React, { useEffect, useState, useRef } from "react";
import { Outlet, useLocation, NavLink } from "react-router-dom";
import { Menu, X, Plus } from "lucide-react";
import AppSidebar from "@/components/layout/AppSidebar";

/** Keyboard: close drawer on ESC */
function useEsc(handler) {
  useEffect(() => {
    const onKey = (e) => (e.key === "Escape" ? handler() : null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

/** Locks body scroll when mobile drawer is open */
function useLockBody(lock) {
  useEffect(() => {
    const { overflow } = document.body.style;
    if (lock) document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = overflow);
  }, [lock]);
}

export default function ProtectedShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const overlayRef = useRef(null);

  // Close drawer whenever route changes (navigating via menu)
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEsc(() => setMobileOpen(false));
  useLockBody(mobileOpen);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Skip link for a11y */}
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] rounded bg-primary px-3 py-2 text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Desktop fixed sidebar */}
      <aside
        className="hidden md:block fixed inset-y-0 left-0 w-64 border-r bg-card z-40"
        aria-label="Sidebar"
      >
        <AppSidebar variant="desktop" />
      </aside>

      {/* Mobile drawer (overlay + panel) */}
      {mobileOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[70] md:hidden"
          aria-modal="true"
          role="dialog"
        >
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[85%] max-w-80 bg-card border-r shadow-xl z-[75] flex"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar variant="mobile" onRequestClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* App header (fixed) */}
      <header className="fixed top-0 left-0 right-0 h-14 md:h-16 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4 md:px-6">
          {/* Hamburger (mobile only) */}
          <button
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Brand / route hint (kept simple; page headers can override inside pages) */}
          <NavLink
            to="/app/dashboard"
            className="font-semibold tracking-tight hover:opacity-90"
          >
            GeniusGrid
          </NavLink>

          <div className="flex-1" />

          {/* Global quick action (optional): keep visible on small screens */}
          <NavLink
            to="/app/crm/leads/new"
            className="inline-flex items-center gap-2 rounded-md border px-3 h-9 text-sm font-medium bg-primary text-primary-foreground hover:opacity-95 active:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">New</span>
          </NavLink>
        </div>
      </header>

      {/* Main content area (respects desktop sidebar width) */}
      <main
        id="app-main"
        className="pt-14 md:pt-16 md:pl-64"
      >
        {/* Page container — use on every page for consistent gutters */}
        <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
          {/* Optional sticky page-level toolbar pattern */}
          {/* 
            Add a div with className="gg-sticky-toolbar" inside pages when needed.
            Example:
            <div className="gg-sticky-toolbar">
              ...filters/search...
              <button className="gg-primary-action">New Lead</button>
            </div>
          */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
