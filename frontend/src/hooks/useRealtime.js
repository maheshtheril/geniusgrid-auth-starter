// frontend/src/hooks/useRealtime.js
import { useEffect, useRef } from "react";

/** Stub: we’ll wire real sockets next. */
export function useRealtime({ onLeadEvent } = {}) {
  const connectedRef = useRef(false);

  useEffect(() => {
    // init socket here later and call onLeadEvent({...}) when events arrive
    connectedRef.current = true;
    return () => { connectedRef.current = false; };
  }, [onLeadEvent]);

  return { connected: connectedRef.current };
}

// Export default too (in case any import expects default)
export default useRealtime;
