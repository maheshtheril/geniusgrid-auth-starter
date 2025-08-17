import React, { useState } from "react";
const uid = () => Math.random().toString(36).slice(2);

export default function AutomationRules(){
  const [rules, setRules] = useState([
    { id: uid(), name:"Notify on won", trigger:"deal.won", action:"notify:manager" },
  ]);
  const add = () => setRules(p => [{ id: uid(), name:"New Rule", trigger:"lead.created", action:"assign:round_robin" }, ...p]);
  const upd = (id, patch) => setRules(p => p.map(r => r.id===id ? {...r,...patch} : r));
  const del = (id) => setRules(p => p.filter(r => r.id!==id));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / AI & Automation / Automation Rules</div><h1 className="text-2xl md:text-3xl font-bold">Automation Rules</h1></div>
      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        <div className="flex justify-between mb-3">
          <div className="font-semibold">Rules</div>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Add</button>
        </div>
        <div className="rounded border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">Name</th><th className="p-2">Trigger</th><th className="p-2">Action</th><th className="p-2 w-28">Actions</th></tr></thead>
            <tbody>
              {rules.map(r=>(
                <tr key={r.id} className="border-b border-white/5">
                  <td className="p-2"><input className="w-full bg-[#0B0D10] border border-white/10 rounded px-2 py-1" value={r.name} onChange={e=>upd(r.id,{name:e.target.value})}/></td>
                  <td className="p-2">
                    <select className="bg-[#0B0D10] border border-white/10 rounded px-2 py-1" value={r.trigger} onChange={e=>upd(r.id,{trigger:e.target.value})}>
                      {["lead.created","lead.assigned","deal.won","invoice.overdue"].map(x=> <option key={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select className="bg-[#0B0D10] border border-white/10 rounded px-2 py-1" value={r.action} onChange={e=>upd(r.id,{action:e.target.value})}>
                      {["assign:round_robin","notify:owner","notify:manager","update:status"].map(x=> <option key={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>del(r.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
