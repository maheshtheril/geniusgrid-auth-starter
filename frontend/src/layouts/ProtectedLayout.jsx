// src/layouts/ProtectedLayout.jsx
import { useEffect, useRef } from "react";
import { useEnv } from "@/store/useEnv";

export default function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;     // hard guard: run once
    bootedRef.current = true;
    bootstrap().catch((e) => {
      console.error("bootstrap failed", e);
      if (e?.response?.status === 401) window.location.href = "/login";
    });
    // NOTE: we intentionally don't depend on `bootstrap` to avoid re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="h-screen w-screen grid place-items-center text-sm opacity-70">
        Loading workspace…
      </div>
    );
  }
  return children;
}
