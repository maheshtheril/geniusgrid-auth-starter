// src/layouts/ProtectedShell.jsx
import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Menu, Plus } from "lucide-react";
import AppSidebar from "@/components/layout/AppSidebar";

export default function ProtectedShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close drawer when route changes
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 z-40 border-r bg-card">
        <AppSidebar variant="desktop" />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[80%] max-w-80 bg-card border-r shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar variant="mobile" onRequestClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 md:h-16 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4 md:px-6">
          <button
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-md border"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <NavLink to="/app/dashboard" className="font-semibold">GeniusGrid</NavLink>
          <div className="flex-1" />
          <NavLink
            to="/app/crm/leads/new"
            className="inline-flex items-center gap-2 rounded-md border px-3 h-9 text-sm font-medium bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">New</span>
          </NavLink>
        </div>
      </header>

      {/* Main */}
      <main className="pt-14 md:pt-16 md:pl-64">
        <div className="px-3 sm:px-4 md:px-6 py-4 md:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
