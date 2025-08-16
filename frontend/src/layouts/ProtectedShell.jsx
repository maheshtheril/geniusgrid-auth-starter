// src/layouts/ProtectedLayout.jsx
import { useEffect, useRef } from "react";
import { useEnv } from "@/store/useEnv";
import { useNavigate } from "react-router-dom";

export default function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();
  const bootedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (bootedRef.current) return; // run once
    bootedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Expectation: bootstrap sets `ready=true` on success.
        // Some backends resolve but still indicate unauthorized via thrown error or status.
        await bootstrap();
      } catch (e) {
        const status =
          e?.response?.status ?? // axios-style
          e?.status ??           // fetch-style
          (typeof e?.message === "string" && /401|403/.test(e.message) ? 401 : undefined);

        if ((status === 401 || status === 403) && !cancelled) {
          navigate("/login", { replace: true });
          return;
        }
        console.error("bootstrap failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div
        className="h-screen w-screen grid place-items-center text-sm opacity-70"
        aria-busy="true"
        aria-live="polite"
      >
        Loading workspace…
      </div>
    );
  }

  return children;
}
