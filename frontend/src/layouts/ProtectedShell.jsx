// src/layouts/ProtectedLayout.jsx
import { useEffect, useRef } from "react";
import { useEnv } from "@/store/useEnv";
import { useNavigate } from "react-router-dom";

export default function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();
  const bootedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      try {
        await bootstrap();                // should set ready=true on success
      } catch (e) {
        const status = e?.response?.status || e?.status;
        if (status === 401) {
          navigate("/login", { replace: true });  // <-- key change
          return;
        }
        console.error("bootstrap failed", e);
      }
    })();
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
