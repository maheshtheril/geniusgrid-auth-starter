import React, { useState } from "react";
export default function IntegrationsAdmin(){
  const [apps, setApps] = useState([
    { code:"slack", name:"Slack", installed:false },
    { code:"hubspot", name:"HubSpot", installed:false },
    { code:"stripe", name:"Stripe", installed:true },
  ]);
  const toggle = (c) => setApps(p => p.map(a => a.code===c ? {...a, installed:!a.installed} : a));
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Integrations</div><h1 className="text-2xl md:text-3xl font-bold">Integrations</h1></div>
      <div className="grid md:grid-cols-3 gap-4">
        {apps.map(a=>(
          <div key={a.code} className="bg-[#111418] rounded-2xl p-5 border border-white/5">
            <div className="font-semibold mb-2">{a.name}</div>
            <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={()=>toggle(a.code)}>
              {a.installed ? "Uninstall" : "Install"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
