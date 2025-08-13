import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api.js";

const Ctx = createContext({ ready: false, ent: { roles: [], modules: [], features: {} }, refresh: () => {} });
export const useEntitlements = () => useContext(Ctx);

export default function EntitlementsProvider({ children, initial }) {
  const [ent, setEnt] = useState(
    initial || window.__BOOT?.ent || { roles: [], modules: [], features: {} }
  );
  const [ready, setReady] = useState(!!(initial || window.__BOOT?.ent));

  async function refresh() {
    try {
      // NOTE: baseURL already = https://.../api, so this hits /api/entitlements
      const r = await api.get("/entitlements");
      const data = r?.data?.data || r?.data || {};
      setEnt({
        roles: data.roles || [],
        modules: data.modules || [],
        features: data.features || {},
      });
      setReady(true);
    } catch (e) {
      // If the old path /billing/entitlements was hardcoded somewhere, it 404s here.
      // In dev, fall back so UI keeps working; remove this fallback in prod if you want.
      console.warn("[ENT] fetch failed, using permissive dev fallback:", e?.response?.status);
      setEnt((prev) => ({
        ...prev,
        features: { ...prev.features, ai_prospecting: true }, // enable AI menu in dev
      }));
      setReady(true);
    }
  }

  useEffect(() => {
    // If not bootstrapped, fetch once
    if (!ready) refresh();
  }, [ready]);

  return <Ctx.Provider value={{ ready, ent, refresh }}>{children}</Ctx.Provider>;
}
