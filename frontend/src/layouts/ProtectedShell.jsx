// src/layouts/ProtectedShell.jsx
import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import AppSidebar from "@/components/layout/AppSidebar";

export default function ProtectedShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 bg-card border-r z-40">
        <AppSidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[80%] max-w-80 bg-card border-r shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <AppSidebar onRequestClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 flex items-center border-b bg-background z-50 px-3">
        <button
          className="md:hidden h-9 w-9 flex items-center justify-center border rounded-md"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <NavLink to="/app/dashboard" className="ml-2 font-semibold">
          GeniusGrid
        </NavLink>
      </header>

      {/* Main */}
      <main className="pt-14 md:pl-64">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
