import React, { useState } from "react";
const uid = () => Math.random().toString(36).slice(2);

export default function CustomFields(){
  const [fields, setFields] = useState([
    { id: uid(), entity: "Lead", name: "Industry", type: "select", required: false },
    { id: uid(), entity: "Company", name: "GSTIN", type: "text", required: false },
  ]);
  const add = () => setFields(p => [{ id: uid(), entity: "Lead", name: "New Field", type: "text", required: false }, ...p]);
  const upd = (id, patch) => setFields(p => p.map(f => f.id===id ? {...f, ...patch} : f));
  const del = (id) => setFields(p => p.filter(f => f.id!==id));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-sm text-gray-400">Admin / Data & Customization / Custom Fields</div>
        <h1 className="text-2xl md:text-3xl font-bold">Custom Fields</h1>
        <p className="text-sm text-gray-400 mt-1">Extend data models with fields per entity.</p>
      </div>

      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        <div className="flex justify-between mb-4">
          <div className="text-base font-semibold">Fields</div>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Add</button>
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 border-b border-white/10">
              <tr><th className="p-2">Entity</th><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Required</th><th className="p-2 w-28">Actions</th></tr>
            </thead>
            <tbody>
              {fields.length===0 ? <tr><td className="p-3 text-gray-400" colSpan={5}>No fields.</td></tr> : fields.map(f=>(
                <tr key={f.id} className="border-b border-white/5">
                  <td className="p-2">
                    <select className="bg-[#0B0D10] border border-white/10 rounded px-2 py-1"
                            value={f.entity} onChange={e=>upd(f.id,{entity:e.target.value})}>
                      {["Lead","Company","Contact","Deal","Invoice"].map(x=> <option key={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <input className="w-full bg-[#0B0D10] border border-white/10 rounded px-2 py-1"
                           value={f.name} onChange={e=>upd(f.id,{name:e.target.value})}/>
                  </td>
                  <td className="p-2">
                    <select className="bg-[#0B0D10] border border-white/10 rounded px-2 py-1"
                            value={f.type} onChange={e=>upd(f.id,{type:e.target.value})}>
                      {["text","number","currency","date","datetime","checkbox","select"].map(t=> <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={f.required} onChange={e=>upd(f.id,{required:e.target.checked})}/>
                  </td>
                  <td className="p-2">
                    <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>del(f.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
