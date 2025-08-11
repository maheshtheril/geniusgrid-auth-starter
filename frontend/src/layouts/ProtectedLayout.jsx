// src/layouts/ProtectedLayout.jsx
import { useEffect, useRef, useState } from "react";
import { useEnv } from "@/store/useEnv";

/**
 * Goals:
 * - Call bootstrap() exactly once even in React.StrictMode (dev double-invoke).
 * - Do NOT unmount children after the first successful load.
 * - If we need to re-sync, keep the UI mounted and show a light overlay.
 */
export default function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();
  const startedRef = useRef(false);
  const shownOnceRef = useRef(false); // have we ever shown the app?
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      bootstrap().catch((e) => {
        console.error("bootstrap failed", e);
        // if interceptor didn’t redirect, hard redirect on 401:
        if (e?.response?.status === 401) window.location.href = "/login";
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run exactly once per mount

  // Remember once the app becomes ready
  useEffect(() => {
    if (ready && !shownOnceRef.current) {
      shownOnceRef.current = true;
      // force a tick to ensure we render the main shell
      forceRerender((n) => n + 1);
    }
  }, [ready]);

  // Before first success, block with a full-screen loader
  if (!ready && !shownOnceRef.current) {
    return (
      <div className="h-screen w-screen grid place-items-center text-sm opacity-70">
        Loading workspace…
      </div>
    );
  }

  // After first success, keep children mounted forever.
  // If ready flips false during a brief re-sync, show a subtle overlay.
  return (
    <div className="relative">
      {children}
      {!ready && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-[1000]">
          <div className="mx-auto mt-2 w-fit rounded-full bg-black/60 px-3 py-1 text-xs text-white shadow">
            Syncing workspace…
          </div>
        </div>
      )}
    </div>
  );
}
