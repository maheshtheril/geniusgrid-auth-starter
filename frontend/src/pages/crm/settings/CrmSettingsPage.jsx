/* -------------------------------- SETTINGS -------------------------------- */
// src/pages/crm/settings/CrmSettingsPage.jsx
import React, { useState } from "react";
import { Settings2 } from "lucide-react";

export default function CrmSettingsPage(){
  const [cfg, setCfg] = useState({
    enableIncentives:true,
    enableCalls:true,
    enableTasks:true,
    autoAssignLeads:false,
    showRevenueInCards:true,
  });
  const set=(k,v)=> setCfg(p=>({...p,[k]:v}));
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Settings2 className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">CRM Settings</h1>
          <p className="text-sm text-muted-foreground">Module preferences (UI only for now).</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-3 md:p-4 space-y-3">
        {[
          ["Enable Incentives","enableIncentives"],
          ["Enable Calls","enableCalls"],
          ["Enable Tasks","enableTasks"],
          ["Auto-assign new leads","autoAssignLeads"],
          ["Show revenue in dashboard cards","showRevenueInCards"],
        ].map(([label,key]) => (
          <label key={key} className="flex items-center gap-3">
            <input type="checkbox" checked={!!cfg[key]} onChange={e=>set(key,e.target.checked)} />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <div className="pt-2 text-xs text-muted-foreground">These switches are placeholders; we’ll persist them when wiring backend.</div>
      </div>
    </div>
  );
}