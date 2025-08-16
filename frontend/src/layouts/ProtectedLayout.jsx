// src/layouts/ProtectedLayout.jsx
import React, { useEffect, useRef, memo } from "react";
import { useEnv } from "@/store/useEnv";

/**
 * ProtectedLayout
 * - Runs bootstrap() exactly once (guards StrictMode double effects).
 * - Provides a full-height, unclipped container so children (sidebar/main) can scroll properly.
 * - Shows a lightweight full-viewport loader until `ready`.
 */
function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return; // hard guard: run once
    bootedRef.current = true;
    (async () => {
      try {
        await bootstrap();
      } catch (e) {
        console.error("bootstrap failed", e);
        const status = e?.response?.status || e?.status;
        if (status === 401) {
          // ensure we bail to login if the session is invalid
          window.location.href = "/login";
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    // Full-viewport loader that won’t interfere with downstream flex/grid sizing
    return (
      <div
        className="protected-layout loading"
        style={{
          height: "100dvh",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          // Safe-area padding for mobile browsers
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div
          className="gg-muted text-sm"
          style={{ opacity: 0.75, letterSpacing: ".2px" }}
        >
          Loading workspace…
        </div>
      </div>
    );
  }

  // IMPORTANT: this wrapper ensures children can own their own scroll areas.
  // (Pairs with .app-shell grid in ProtectedShell + .nav-scroll in AppSidebar)
  return (
    <div
      className="protected-layout"
      style={{
        height: "100dvh",
        minHeight: 0,         // CRITICAL so inner panes can shrink & scroll
        overflow: "hidden",   // only inner regions should scroll
        display: "block",
        // Safe-area padding for mobile browsers
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {children}
    </div>
  );
}

export default memo(ProtectedLayout);
