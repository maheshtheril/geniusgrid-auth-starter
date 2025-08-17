// src/layouts/ProtectedShell.jsx
import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";

export default function ProtectedShell() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen">

      {/* 🔴 FORCED VISIBLE SIDEBAR (no imports, no aliases) */}
      <aside
        className="fixed inset-y-0 left-0 w-64 z-[9999] border-r text-white"
        style={{ background: '#ef4444' }} // tailwind red-500 but inline to avoid any theme issues
      >
        <div className="h-14 flex items-center px-4 font-bold border-b border-white/30">
          GeniusGrid
        </div>

        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          {[
            { to: "/app/dashboard", label: "Dashboard" },
            { to: "/app/crm/leads", label: "Leads" },
            { to: "/app/crm/companies", label: "Companies" },
            { to: "/app/admin/org", label: "Admin" },
          ].map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md hover:bg-white/20 ${isActive ? "bg-white/25" : ""}`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Header (offset for sidebar) */}
      <header className="fixed top-0 left-64 right-0 h-14 z-[9999] border-b bg-white">
        <div className="h-full flex items-center px-3 text-sm">
          <strong>Header</strong>
          <span className="ml-3 text-gray-500">path: {pathname}</span>
        </div>
      </header>

      {/* Main content (offset for sidebar + header) */}
      <main className="pt-14 pl-64">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
