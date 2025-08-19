// src/layouts/ProtectedShell.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/layout/AppSidebar";
import Topbar from "@/components/layout/Topbar";

const LS_COLLAPSED = "gg:sidebar:collapsed";
const DESK_OPEN_W = 260; // px
const DESK_MINI_W = 64;  // px

export default function ProtectedShell() {
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem(LS_COLLAPSED) === "1"; } catch { return false; }
  });

  // If you're on mobile and the drawer was closed, you won't see the sidebar.
  // Start closed (normal), but the burger will open it.
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Keep a CSS var for app layouts that use --sbw
  React.useEffect(() => {
    const w = collapsed ? DESK_MINI_W : DESK_OPEN_W;
    document.documentElement.style.setProperty("--sbw", `${w}px`);
  }, [collapsed]);

  const toggleCollapse = React.useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(LS_COLLAPSED, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen w-full bg-base-200 text-base-content flex">
      {/* Mobile overlay (click to close) */}
      <div
        className={[
          "fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-sm transition-opacity",
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Sidebar: drawer on mobile, fixed on desktop */}
      <aside
        aria-label="Sidebar"
        className={[
          "fixed left-0 top-0 h-screen bg-base-100 border-r border-base-300",
          "transition-[transform,width] duration-200 ease-out will-change-transform",
          // Drawer behavior
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: ALWAYS visible
          "md:translate-x-0",
          // Widths
          collapsed ? "md:w-16" : "md:w-64",
          "w-[86vw] max-w-[320px]",
          // Stacking: keep above content on mobile, below topbar on desktop
          "z-50 md:z-10",
          // Sticky on desktop so it scrolls with the page
          "md:sticky md:top-0 md:self-start",
        ].join(" ")}
      >
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onRequestClose={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0">
        {/* Burger shows only if we pass onBurger */}
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onBurger={() => setDrawerOpen(true)}
        />
        <main className="px-2 sm:px-4 md:px-6 py-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
