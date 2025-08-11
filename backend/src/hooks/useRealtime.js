// Stub for now; we’ll wire WebSocket next step
import { useEffect, useRef } from "react";

export function useRealtime({ onLeadEvent } = {}) {
  const readyRef = useRef(false);

  useEffect(() => {
    // placeholder: swap with real socket client
    readyRef.current = true;
    return () => { readyRef.current = false; };
  }, []);

  return { connected: readyRef.current };
}
