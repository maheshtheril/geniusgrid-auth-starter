// src/layouts/ProtectedLayout.jsx
import { useEffect } from "react";
import { useEnv } from "@/store/useEnv";

export default function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();

  useEffect(() => {
    bootstrap().catch((e) => {
      console.error("bootstrap failed", e);
      // if axios interceptor doesn't redirect, hard redirect:
      if (e?.response?.status === 401) window.location.href = "/login";
    });
  }, [bootstrap]);

  if (!ready) {
    return (
      <div className="h-screen w-screen grid place-items-center text-sm opacity-70">
        Loading workspace…
      </div>
    );
  }
  return children;
}
