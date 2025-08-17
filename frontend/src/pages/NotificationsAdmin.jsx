import React, { useState } from "react";
export default function NotificationsAdmin(){
  const [cfg, setCfg] = useState({
    email:true, push:true, slack:false,
    events: { lead_assigned:true, deal_won:true, invoice_overdue:true }
  });
  const up = (k,v)=>setCfg(p=>({...p,[k]:v}));
  const upe = (k,v)=>setCfg(p=>({...p, events:{...p.events,[k]:v}}));
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Data & Customization / Notifications</div><h1 className="text-2xl md:text-3xl font-bold">Notifications</h1></div>
      <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          {["email","push","slack"].map(ch=>(
            <label key={ch} className="flex items-center gap-2 bg-[#0B0D10] border border-white/10 rounded px-3 py-2">
              <input type="checkbox" checked={cfg[ch]} onChange={e=>up(ch,e.target.checked)}/>
              <span className="capitalize">{ch}</span>
            </label>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {Object.keys(cfg.events).map(e=>(
            <label key={e} className="flex items-center gap-2 bg-[#0B0D10] border border-white/10 rounded px-3 py-2">
              <input type="checkbox" checked={cfg.events[e]} onChange={ev=>upe(e,ev.target.checked)}/>
              <span className="capitalize">{e.replaceAll("_"," ")}</span>
            </label>
          ))}
        </div>
        <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">Save</button>
      </section>
    </div>
  );
}
