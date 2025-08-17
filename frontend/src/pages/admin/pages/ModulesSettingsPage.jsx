// ---------- FILE: src/pages/admin/pages/ModulesSettingsPage.jsx ----------
import React, { useEffect, useState } from "react";
import { Box } from "lucide-react";
import { fetcher } from "@/pages/admin/_shared/fetcher";

const ALL_MODULES = [
  { key:"crm", label:"CRM" },
  { key:"sales", label:"Sales" },
  { key:"hr", label:"HR" },
  { key:"accounts", label:"Accounts" },
  { key:"projects", label:"Projects" },
  { key:"inventory", label:"Inventory" },
];

export default function ModulesSettingsPage(){
  const [enabled, setEnabled] = useState(["crm","sales"]);

  useEffect(()=>{ (async()=>{
    const data = await fetcher("/api/admin/modules", { fallback: enabled });
    if (Array.isArray(data)) setEnabled(data);
  })(); }, []);

  function toggle(k){ setEnabled(v => v.includes(k)? v.filter(x=>x!==k) : [...v,k]); }

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Box size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Modules</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_MODULES.map(m => (
          <label key={m.key} className="border rounded-xl p-4 flex items-center gap-3 hover:bg-white/5">
            <input type="checkbox" className="h-5 w-5" checked={enabled.includes(m.key)} onChange={()=>toggle(m.key)} />
            <span className="font-medium">{m.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs opacity-70 mt-3">These toggles only affect UI visibility now; backend enforcement can be added later.</p>
    </section>
  );
}

