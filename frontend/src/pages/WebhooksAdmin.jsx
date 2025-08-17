import React, { useState } from "react";
const uid = () => Math.random().toString(36).slice(2);

export default function WebhooksAdmin(){
  const [hooks, setHooks] = useState([{ id: uid(), url:"https://example.com/webhook", event:"deal.updated", secret:"sh_123", active:true }]);
  const add = () => setHooks(p => [{ id: uid(), url:"", event:"lead.created", secret:"sh_"+uid(), active:true }, ...p]);
  const upd = (id, patch) => setHooks(p => p.map(h => h.id===id ? {...h, ...patch} : h));
  const del = (id) => setHooks(p => p.filter(h => h.id!==id));
  const ping = () => alert("Mock: sent test event");

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Webhooks</div><h1 className="text-2xl md:text-3xl font-bold">Webhooks</h1></div>
      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        <div className="flex justify-between mb-3">
          <div className="font-semibold">Endpoints</div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={ping}>Send test</button>
            <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Add</button>
          </div>
        </div>
        <div className="rounded border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">URL</th><th className="p-2">Event</th><th className="p-2">Secret</th><th className="p-2">Active</th><th className="p-2 w-28">Actions</th></tr></thead>
            <tbody>
              {hooks.map(h=>(
                <tr key={h.id} className="border-b border-white/5">
                  <td className="p-2"><input className="w-full bg-[#0B0D10] border border-white/10 rounded px-2 py-1" value={h.url} onChange={e=>upd(h.id,{url:e.target.value})}/></td>
                  <td className="p-2">
                    <select className="bg-[#0B0D10] border border-white/10 rounded px-2 py-1" value={h.event} onChange={e=>upd(h.id,{event:e.target.value})}>
                      {["lead.created","lead.assigned","deal.updated","invoice.paid"].map(x=> <option key={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><code>{h.secret}</code></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={h.active} onChange={e=>upd(h.id,{active:e.target.checked})}/></td>
                  <td className="p-2"><button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>del(h.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
