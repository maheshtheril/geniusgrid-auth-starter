// ---------- FILE: src/layouts/ProtectedShell.jsx ----------
import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";

// Use a RELATIVE import to avoid alias resolution issues during build.
import AppSidebar from "../components/layout/AppSidebar";

export default function ProtectedShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on route change
  useEffect(() => {
    if (navOpen) setNavOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ESC to close (mobile drawer)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = navOpen ? "hidden" : prev || "";
    return () => (document.body.style.overflow = prev);
  }, [navOpen]);

  return (
    <div className="min-h-screen bg-[#0B0D10] text-gray-200">
      {/* Skip link for a11y */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 bg-indigo-600 text-white px-3 py-1 rounded"
      >
        Skip to content
      </a>

      <div className="flex">
        {/* DESKTOP SIDEBAR (fixed) */}
        <div className="hidden md:block fixed inset-y-0 left-0 w-64 z-40 bg-gray-900 border-r border-gray-800">
          <AppSidebar />
        </div>

        {/* MOBILE DRAWER */}
        {/* Backdrop */}
        {navOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden="true"
            onClick={() => setNavOpen(false)}
          />
        )}
        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={[
            "fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[18rem] md:hidden",
            "bg-gray-900 border-r border-gray-800 shadow-xl",
            "transform transition-transform duration-300",
            navOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <AppSidebar onRequestClose={() => setNavOpen(false)} />
        </div>

        {/* MAIN COLUMN (push right when desktop sidebar is visible) */}
        <div className="flex-1 min-w-0 md:pl-64 flex flex-col">
          {/* Top bar */}
          <header className="h-14 border-b border-gray-800 flex items-center justify-between px-3 md:px-4">
            {/* Left: hamburger + brand */}
            <div className="flex items-center gap-2">
              <button
                className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-800 hover:bg-gray-800/50"
                onClick={() => setNavOpen(true)}
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <NavLink to="/dashboard" className="font-semibold no-underline text-gray-100">
                GeniusGrid
              </NavLink>
            </div>

            {/* Quick links (hide on very small) */}
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <NavLink to="/app/crm/leads" className={({isActive})=>isActive?"text-white":"text-gray-300 hover:text-white"}>Leads</NavLink>
              <NavLink to="/app/crm/companies" className={({isActive})=>isActive?"text-white":"text-gray-300 hover:text-white"}>Companies</NavLink>
              <NavLink to="/app/crm/deals" className={({isActive})=>isActive?"text-white":"text-gray-300 hover:text-white"}>Deals</NavLink>
            </nav>

            {/* Right: admin + user */}
            <div className="flex items-center gap-2">
              <NavLink
                to="/app/admin/org"
                className="hidden sm:inline-flex h-9 px-3 rounded-lg border border-gray-800 hover:bg-gray-800/50 text-sm no-underline"
              >
                Admin
              </NavLink>
              <div className="h-8 w-8 rounded-full bg-gray-800 grid place-items-center text-xs">U</div>
            </div>
          </header>

          {/* Page content */}
          <main id="main" className="container-page min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
