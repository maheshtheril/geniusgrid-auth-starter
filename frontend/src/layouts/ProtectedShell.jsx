// src/layouts/ProtectedShell.jsx
import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
// Use RELATIVE import so alias issues can't break it
import AppSidebar from "../components/layout/AppSidebar.jsx";

export default function ProtectedShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar (theme) */}
      <aside className="fixed inset-y-0 left-0 w-64 z-40 border-r bg-card">
        <AppSidebar onRequestClose={() => setMobileOpen(false)} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div
            className="absolute inset-y-0 left-0 w-[85%] max-w-80 bg-card border-r shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar onRequestClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 md:h-16 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4 md:px-6">
          <button
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-md border"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <NavLink to="/app/dashboard" className="font-semibold tracking-tight">
            GeniusGrid
          </NavLink>
        </div>
      </header>

      {/* Main content (offset for header + desktop sidebar) */}
      <main className="pt-14 md:pt-16 md:pl-64">
        <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
