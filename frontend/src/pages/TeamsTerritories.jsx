import React, { useEffect, useMemo, useState } from "react";
const STORE_KEY = "teams_territories_v1";

const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);
const Input = (p) => <input {...p} className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className||"")} />;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const seed = () => ([
  { id: uid(), name: "HQ", code: "HQ", manager: "Aisha Rao", territory: "National", members: "aisha@acme.com", parentId: null, active: true },
  { id: uid(), name: "West Team", code: "WEST", manager: "Karan Shah", territory: "Maharashtra/Gujarat", members: "karan@acme.com", parentId: null, active: true },
  { id: uid(), name: "Mumbai Pod", code: "MUM", manager: "—", territory: "Mumbai", members: "", parentId: null, active: true },
]);

function buildTree(items){
  const byId = new Map(); const roots = [];
  (items||[]).forEach(t => byId.set(t.id, { ...t, children: [] }));
  byId.forEach(t => t.parentId && byId.has(t.parentId) ? byId.get(t.parentId).children.push(t) : roots.push(t));
  return roots;
}

export default function TeamsTerritories(){
  const [items, setItems] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch{} }
    return seed();
  });
  const [expanded, setExpanded] = useState(()=>new Set());
  const [msg, setMsg] = useState("");
  const tree = useMemo(()=>buildTree(items),[items]);

  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(items)); },[items]);
  const toast = (t)=>{ setMsg(t); setTimeout(()=>setMsg(""),900); };

  const addRoot = ()=>{ const n = { id: uid(), name: "New Team", code:"", manager:"", territory:"", members:"", parentId:null, active:true }; setItems(p=>[n,...p]); toast("Added"); };
  const addChild = (pid)=>{ const n = { id: uid(), name: "Subteam", code:"", manager:"", territory:"", members:"", parentId:pid, active:true }; setItems(p=>[...p,n]); setExpanded(s=>new Set([...s,pid])); toast("Added"); };
  const update = (id, patch) => setItems(prev => prev.map(x => x.id===id ? {...x,...patch}:x));
  const remove = (id) => { const drop = new Set([id]); const walk=(pid)=>items.forEach(x=>x.parentId===pid && (drop.add(x.id),walk(x.id))); walk(id); setItems(prev=>prev.filter(x=>!drop.has(x.id))); toast("Removed"); };
  const toggleOpen = (id)=> setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const Node = ({ node, depth=0 }) => {
    const open = expanded.has(node.id);
    const pad = { paddingLeft: `${depth*16 + 8}px` };
    return (
      <div className="border-b border-white/5">
        <div className="flex items-center gap-2 py-2" style={pad}>
          <button className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 grid place-items-center" onClick={()=>toggleOpen(node.id)}>{open?"▾":"▸"}</button>
          <input className="flex-1 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm" placeholder="Team name" value={node.name} onChange={(e)=>update(node.id,{name:e.target.value})} />
          <input className="w-24 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm" placeholder="Code" value={node.code} onChange={(e)=>update(node.id,{code:e.target.value.toUpperCase()})} />
          <input className="w-40 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm" placeholder="Manager" value={node.manager} onChange={(e)=>update(node.id,{manager:e.target.value})} />
          <input className="w-48 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm" placeholder="Territory" value={node.territory} onChange={(e)=>update(node.id,{territory:e.target.value})} />
          <input className="w-56 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm" placeholder="Members (emails)" value={node.members} onChange={(e)=>update(node.id,{members:e.target.value})} />
          <label className="text-xs flex items-center gap-2 px-2 py-1 rounded bg-white/5">
            <input type="checkbox" checked={!!node.active} onChange={(e)=>update(node.id,{active:e.target.checked})} /> Active
          </label>
          <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>addChild(node.id)}>+ Subteam</button>
          <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>remove(node.id)}>✖</button>
        </div>
        {open && (node.children||[]).map(c => <Node key={c.id} node={c} depth={depth+1} />)}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Access Control / Teams & Territories</div>
          <h1 className="text-2xl md:text-3xl font-bold">Teams & Territories</h1>
          <p className="text-sm text-gray-400 mt-1">Organize teams and sales territories with subteams.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addRoot}>+ Add Team</button>
        </div>
      </div>

      <Section title="Hierarchy" desc="Use ▸ to expand. Remove cascades to children.">
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {tree.length===0 ? <div className="p-4 text-sm text-gray-400">No teams yet.</div> : tree.map(n => <Node key={n.id} node={n} />)}
        </div>
      </Section>
    </div>
  );
}
