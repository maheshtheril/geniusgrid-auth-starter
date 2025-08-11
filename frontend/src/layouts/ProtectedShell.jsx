// src/layouts/ProtectedShell.jsx
import React, { memo, useMemo } from "react";
import ProtectedLayout from "./ProtectedLayout";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import { Outlet, useLocation } from "react-router-dom";

function ProtectedShell() {
  const { pathname } = useLocation();

  // Don’t remount heavy chrome on every minor re-render
  const sidebarEl = useMemo(() => <AppSidebar />, []);
  const topbarEl  = useMemo(() => <AppTopbar />, []);

  // Only recreate Outlet element when the actual route path changes
  const outletEl  = useMemo(() => <Outlet />, [pathname]);

  return (
    <ProtectedLayout>
      <div className="app-shell">
        {sidebarEl}
        <main className="app-main">
          {topbarEl}
          <div className="app-content">
            {outletEl}
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}

export default memo(ProtectedShell);
