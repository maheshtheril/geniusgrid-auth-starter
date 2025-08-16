// src/layouts/ProtectedShell.jsx
import React, { memo, useMemo } from "react";
import ProtectedLayout from "./ProtectedLayout";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import { Outlet, useLocation } from "react-router-dom";

/**
 * Shell layout: Sidebar (independent vertical scroll) + Main (independent scroll)
 * Uses a grid container .app-shell to avoid parent height clipping.
 * The .app-main contains a sticky topbar and a content area that can scroll.
 */
function ProtectedShell() {
  const { pathname } = useLocation();

  // Memoize heavy subtree mounts (avoid reflow spikes)
  const sidebarEl = useMemo(() => <AppSidebar />, []);
  const topbarEl  = useMemo(() => <AppTopbar />, []);
  const outletEl  = useMemo(() => <Outlet />, [pathname]);

  return (
    <ProtectedLayout>
      <div className="app-shell">
        {/* LEFT: Sidebar column (owns its own vertical scroll inside the component) */}
        {sidebarEl}

        {/* RIGHT: Main column */}
        <main className="app-main">
          {/* Sticky topbar */}
          <div className="app-topbar-wrap">
            {topbarEl}
          </div>

          {/* Content area (independent scroll; never clips) */}
          <div className="app-content">
            {outletEl}
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}

export default memo(ProtectedShell);
