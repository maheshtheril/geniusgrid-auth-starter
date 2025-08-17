import React, { useState } from "react";
const uid = () => Math.random().toString(36).slice(2);

export default function AdminApprovals(){
  const [flows, setFlows] = useState([{ id: uid(), name:"Discount > 20%", steps:["Manager","Finance"] }]);
  const add = () => setFlows(p => [{ id: uid(), name:"New Flow", steps:["Manager"] }, ...p]);
  const addStep = (id) => setFlows(p => p.map(f => f.id===id ? {...f, steps:[...f.steps,"Approver"]} : f));
  const delStep = (id, i) => setFlows(p => p.map(f => f.id===id ? {...f, steps:f.steps.filter((_,idx)=>idx!==i)} : f));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / AI & Automation / Approvals</div><h1 className="text-2xl md:text-3xl font-bold">Approvals</h1></div>
      <div className="space-y-4">
        {flows.map(f=>(
          <div key={f.id} className="bg-[#111418] rounded-2xl p-6 border border-white/5">
            <input className="bg-[#0B0D10] border border-white/10 rounded px-3 py-2 mb-3" value={f.name}
                   onChange={e=>setFlows(p=>p.map(x=>x.id===f.id?{...x,name:e.target.value}:x))}/>
            <div className="flex flex-wrap gap-2">
              {f.steps.map((s,i)=>(
                <span key={i} className="inline-flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 text-sm">
                  {s}
                  <button onClick={()=>delStep(f.id,i)} className="text-xs opacity-80 hover:opacity-100">✖</button>
                </span>
              ))}
              <button className="px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5" onClick={()=>addStep(f.id)}>+ Step</button>
            </div>
          </div>
        ))}
        <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Flow</button>
      </div>
    </div>
  );
}
