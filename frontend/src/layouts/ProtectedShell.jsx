// src/layouts/ProtectedShell.jsx
import React, { memo, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import ProtectedLayout from "./ProtectedLayout";
import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
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
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/app/admin");

  // keep these memoized
  const sidebarEl = useMemo(() => <AppSidebar />, []);
  const topbarEl  = useMemo(() => <AppTopbar />, []);

  // Content wrappers:
  // - defaultWrap keeps non-admin pages pleasantly centered (optional cap)
  // - adminWrap removes any max-width so the console can breathe
  const defaultWrap = {
    width: "100%",
    maxWidth: 1280,       // tune or remove if you want fully fluid everywhere
    margin: "0 auto",
    padding: "0 16px",
    minWidth: 0,
    boxSizing: "border-box",
  };
  const adminWrap = {
    width: "100%",
    maxWidth: "none",
    margin: 0,
    padding: 0,
    minWidth: 0,
    boxSizing: "border-box",
  };

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
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Page width controller */}
            <div style={isAdmin ? adminWrap : defaultWrap}>
              {/* DO NOT memoize Outlet */}
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* remove after testing */}
      <DebugHUD />
    </ProtectedLayout>
  );
}

export default memo(ProtectedShell);
