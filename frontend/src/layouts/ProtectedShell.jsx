// src/layouts/ProtectedShell.jsx
import React, { memo, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import ProtectedLayout from "./ProtectedLayout";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import { useEnv } from "@/store/useEnv";

// Optional: keep while testing; remove when done
function DebugHUD() {
  const { ready, menus } = useEnv() || {};
  const { pathname } = useLocation();
  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,.6)",
        color: "#fff",
        padding: "6px 8px",
        fontSize: 11,
        borderRadius: 6,
        pointerEvents: "none",
      }}
    >
      <div>ready: {String(ready)}</div>
      <div>path: {pathname}</div>
      <div>menus: {Array.isArray(menus) ? menus.length : 0}</div>
    </div>
  );
}

function ProtectedShell() {
  // memoize heavy children so routing doesn't re-render them
  const sidebarEl = useMemo(() => <AppSidebar />, []);
  const topbarEl  = useMemo(() => <AppTopbar />, []);

  return (
    <ProtectedLayout>
      <div
        className="app-shell"
        style={{
          display: "flex",
          width: "100%",
          height: "100dvh",
          minHeight: 0,   // allows children to scroll
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {sidebarEl}

        <main
          className="app-main"
          style={{
            display: "flex",
            flex: "1 1 auto",
            minHeight: 0,
            minWidth: 0,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {topbarEl}

          {/* Full-width content area (no maxWidth cap) */}
          <div
            className="app-content"
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              minWidth: 0,
              overflowY: "auto",
              overflowX: "hidden",
              position: "relative",
              // a little breathing room without constraining width
              padding: "0 12px 16px",
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>

      <DebugHUD />
    </ProtectedLayout>
  );
}

export default memo(ProtectedShell);
