// ---------- FILE: src/pages/admin/pages/SystemHealthPage.jsx ----------
import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { fetcher } from "@/pages/admin/_shared/fetcher";

export default function SystemHealthPage(){
  const [health, setHealth] = useState(null);
  const [version, setVersion] = useState(null);

  useEffect(()=>{ (async()=>{
    const h = await fetcher("/api/healthz", { fallback: { ok: true, time: new Date().toISOString() } });
    setHealth(h);
    const v = await fetcher("/api/version", { fallback: { version: "dev" } });
    setVersion(v);
  })(); }, []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Activity size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">System Health</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded-xl p-4">
          <div className="text-xs opacity-70">API Health</div>
          <div className="text-lg font-semibold">{health?.ok ? "OK" : "Down"}</div>
          <div className="text-xs opacity-60 mt-1">{health?.time}</div>
        </div>
        <div className="border rounded-xl p-4">
          <div className="text-xs opacity-70">Version</div>
          <div className="text-lg font-semibold">{version?.version || "dev"}</div>
        </div>
        <div className="border rounded-xl p-4">
          <div className="text-xs opacity-70">DB</div>
          <div className="text-lg font-semibold">—</div>
          <div className="text-xs opacity-60 mt-1">(Wire later)</div>
        </div>
      </div>
    </section>
  );
}
