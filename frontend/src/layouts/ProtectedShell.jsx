import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "../components/layout/AppSidebar.jsx"; // relative!

export default function ProtectedShell() {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-64 border-r bg-card z-40">
        <AppSidebar />
      </aside>
      <header className="fixed top-0 left-64 right-0 h-14 border-b bg-background z-50 flex items-center px-3">
        GeniusGrid
      </header>
      <main className="pt-14 pl-64">
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
