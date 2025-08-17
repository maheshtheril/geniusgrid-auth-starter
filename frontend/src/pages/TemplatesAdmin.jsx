import React, { useState } from "react";
const uid = () => Math.random().toString(36).slice(2);

export default function TemplatesAdmin(){
  const [items, setItems] = useState([
    { id: uid(), name: "Welcome Email", type:"email", content:"Welcome to GeniusGrid!" },
    { id: uid(), name: "Quote PDF", type:"pdf", content:"Quote template here..." },
  ]);
  const [sel, setSel] = useState(items[0]?.id || null);
  const add = () => { const n={id:uid(), name:"New Template", type:"email", content:""}; setItems(p=>[n,...p]); setSel(n.id); };
  const upd = (id, patch) => setItems(p => p.map(x => x.id===id ? {...x,...patch} : x));
  const del = (id) => { const next = items.filter(x=>x.id!==id); setItems(next); if(sel===id) setSel(next[0]?.id||null); };
  const cur = items.find(x=>x.id===sel);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-sm text-gray-400">Admin / Data & Customization / Templates</div>
        <h1 className="text-2xl md:text-3xl font-bold">Templates</h1>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-4 bg-[#111418] rounded-2xl p-4 border border-white/5">
          <div className="flex justify-between mb-3">
            <div className="font-semibold">All</div>
            <button className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Add</button>
          </div>
          <div className="rounded border border-white/10 overflow-hidden">
            {items.map(t=>(
              <div key={t.id} className={["px-3 py-2 border-b border-white/5 cursor-pointer", sel===t.id?"bg-white/10":"hover:bg-white/5"].join(" ")}
                   onClick={()=>setSel(t.id)}>
                <div className="flex justify-between">
                  <div className="truncate">{t.name}</div>
                  <button className="text-xs px-2 py-0.5 rounded border border-white/10 hover:bg-white/5" onClick={(e)=>{e.stopPropagation(); del(t.id);}}>✖</button>
                </div>
                <div className="text-xs text-gray-400">{t.type}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-8 bg-[#111418] rounded-2xl p-4 border border-white/5">
          {!cur ? <div className="text-sm text-gray-400">Select a template.</div> : (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-gray-400 mb-1">Name</div>
                  <input className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={cur.name} onChange={e=>upd(cur.id,{name:e.target.value})}/>
                </label>
                <label className="block">
                  <div className="text-xs text-gray-400 mb-1">Type</div>
                  <select className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={cur.type} onChange={e=>upd(cur.id,{type:e.target.value})}>
                    {["email","sms","pdf"].map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <div className="text-xs text-gray-400 mb-1">Content</div>
                <textarea className="w-full h-48 bg-[#0B0D10] border border-white/10 rounded px-3 py-2"
                          value={cur.content} onChange={e=>upd(cur.id,{content:e.target.value})}/>
              </label>
              <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">Save</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
