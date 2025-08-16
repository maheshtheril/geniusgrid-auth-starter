// src/layouts/ProtectedShell.jsx
import React, { memo, useMemo } from "react";
import ProtectedLayout from "./ProtectedLayout";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import { Outlet, useLocation } from "react-router-dom";
import { useEnv } from "@/store/useEnv";

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
  // keep these memoized
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
          minHeight: 0,            // critical so children can shrink/scroll
          overflow: "hidden",
        }}
      >
        {sidebarEl}

        <main
          className="app-main"
          style={{
            display: "flex",
            flex: "1 1 auto",
            minHeight: 0,          // critical
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {topbarEl}

          <div
            className="app-content"
            style={{
              flex: "1 1 auto",
              minHeight: 0,        // critical
              overflowY: "auto",
              overflowX: "hidden",
              position: "relative",
            }}
          >
            {/* DO NOT memoize Outlet */}
            <Outlet />
          </div>
        </main>
      </div>

      {/* remove after testing */}
      <DebugHUD />
    </ProtectedLayout>
  );
}

export default memo(ProtectedShell);
