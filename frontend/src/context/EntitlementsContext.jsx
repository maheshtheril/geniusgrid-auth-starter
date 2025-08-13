// src/context/EntitlementsContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { fetchEntitlements } from "@/lib/entitlements";

const EntCtx = createContext({
  ready: false,
  ent: null,
  hasFeature: () => false,
  hasRole: () => false,
  setEntitlements: () => {},
});

export function EntitlementsProvider({ children, initial }) {
  const [ent, setEnt] = useState(initial || null);
  const [ready, setReady] = useState(!!initial);

  useEffect(() => {
    if (ready) return;
    (async () => {
      try {
        const e = await fetchEntitlements();
        setEnt(e || { features: {}, roles: [] });
      } finally {
        setReady(true);
      }
    })();
  }, [ready]);

  const hasFeature = (f) => !!(ent?.features && ent.features[f]);
  const hasRole = (r) => !!(ent?.roles || []).includes(r);

  return (
    <EntCtx.Provider value={{ ready, ent, hasFeature, hasRole, setEntitlements: setEnt }}>
      {children}
    </EntCtx.Provider>
  );
}

export const useEntitlements = () => useContext(EntCtx);
