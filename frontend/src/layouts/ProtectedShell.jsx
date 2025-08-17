// src/layouts/ProtectedShell.jsx
import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";

export default function ProtectedShell() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B0D10] text-gray-200">
      {/* DESKTOP: fixed sidebar ALWAYS visible */}
      <aside className="hidden md:block fixed inset-y-0 left-0 w-64 z-40 bg-gray-900 border-r border-gray-800">
        <AppSidebar />
      </aside>

      {/* MOBILE: slide-in drawer */}
      {navOpen && (
        <>
          <button
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          />
          <div className="fixed inset-y-0 left-0 w-72 z-50 md:hidden bg-gray-900 shadow-2xl">
            <AppSidebar onRequestClose={() => setNavOpen(false)} />
          </div>
        </>
      )}

      {/* MAIN: reserve space for desktop sidebar */}
      <div className="md:pl-64 min-h-screen flex flex-col">
        <header className="h-14 border-b border-gray-800 flex items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 hover:bg-gray-800/50"
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

          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <NavLink to="/app/crm/leads" className={({isActive})=>isActive?"text-white":"text-gray-300 hover:text-white"}>Leads</NavLink>
            <NavLink to="/app/crm/companies" className={({isActive})=>isActive?"text-white":"text-gray-300 hover:text-white"}>Companies</NavLink>
            <NavLink to="/app/crm/deals" className={({isActive})=>isActive?"text-white":"text-gray-300 hover:text-white"}>Deals</NavLink>
          </nav>

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

        <main className="container-page min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
