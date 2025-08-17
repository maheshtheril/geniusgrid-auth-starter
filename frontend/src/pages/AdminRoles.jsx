import React, { useEffect, useMemo, useState } from "react";

const STORE_KEY = "admin_roles_v1";
const RESOURCES = ["leads","deals","companies","contacts","reports","settings","users"];
const ACTIONS   = ["read","create","update","delete","export","approve"];

const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</span>
    {children}
  </label>
);
const Input = (p) => <input {...p} className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className||"")} />;
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const seed = () => ([
  { id: uid(), name: "Admin",   code: "ADMIN",   desc: "Full access",           perms: ["*"] },
  { id: uid(), name: "Manager", code: "MANAGER", desc: "Manage team & pipeline", perms: ["leads.*","deals.*","reports.read","users.read"] },
  { id: uid(), name: "SalesRep",code: "SALES",   desc: "Own deals/leads",        perms: ["leads.read","leads.create","deals.read","deals.create","companies.read","contacts.read"] },
  { id: uid(), name: "Viewer",  code: "VIEWER",  desc: "Read-only",              perms: RESOURCES.map(r=>`${r}.read`) },
]);

export default function AdminRoles(){
  const [roles, setRoles] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch{} }
    return seed();
  });
  const [selectedId, setSelectedId] = useState(() => roles[0]?.id || null);
  const [q, setQ] = useState("");
  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(roles)); },[roles]);

  const filtered = useMemo(()=>{
    const s = q.trim().toLowerCase();
    if (!s) return roles;
    return roles.filter(r => [r.name,r.code,r.desc].some(v => String(v||"").toLowerCase().includes(s)));
  },[roles,q]);
  const selected = roles.find(r => r.id===selectedId) || null;

  const add = () => {
    const n = { id: uid(), name: "New Role", code: "", desc: "", perms: [] };
    setRoles(prev => [n, ...prev]); setSelectedId(n.id);
  };
  const remove = (id)=> {
    const next = roles.filter(r=>r.id!==id); setRoles(next);
    if (selectedId===id) setSelectedId(next[0]?.id||null);
  };
  const update = (id, patch)=> setRoles(prev => prev.map(r => r.id===id ? {...r,...patch} : r));

  const has = (p) => selected?.perms?.includes(p) || selected?.perms?.includes("*") || selected?.perms?.includes(`${p.split(".")[0]}.*`);
  const toggle = (p) => {
    if (!selected) return;
    if (has(p)) update(selected.id, { perms: selected.perms.filter(x => x!==p && x!=="*") });
    else update(selected.id, { perms: [...selected.perms, p] });
  };
  const toggleWild = (res) => {
    const w = `${res}.*`;
    if (!selected) return;
    const on = selected.perms.includes(w);
    update(selected.id, { perms: on ? selected.perms.filter(x=>x!==w) : [...selected.perms, w] });
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Access Control / Roles</div>
          <h1 className="text-2xl md:text-3xl font-bold">Roles</h1>
          <p className="text-sm text-gray-400 mt-1">Define roles and permissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Add</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-4">
          <Section title="All Roles">
            <div className="mb-3"><Input placeholder="Search…" value={q} onChange={(e)=>setQ(e.target.value)} /></div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length===0 ? <div className="p-4 text-sm text-gray-400">No roles.</div> : filtered.map(r=>{
                const active = r.id===selectedId;
                return (
                  <div key={r.id}
                       className={["px-3 py-2 border-b border-white/5 cursor-pointer", active?"bg-white/10":"hover:bg-white/5"].join(" ")}
                       onClick={()=>setSelectedId(r.id)}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className="text-xs text-gray-400 truncate">{r.code || "—"} • {(r.perms||[]).length} perms</div>
                      </div>
                      <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={(e)=>{e.stopPropagation(); remove(r.id);}}>✖</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="md:col-span-8">
          {!selected ? (
            <Section title="Editor"><div className="text-sm text-gray-400">Select a role.</div></Section>
          ) : (
            <>
              <Section title="Role Details">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Name"><Input value={selected.name} onChange={(e)=>update(selected.id,{name:e.target.value})} /></Field>
                  <Field label="Code"><Input value={selected.code} onChange={(e)=>update(selected.id,{code:e.target.value.toUpperCase()})} /></Field>
                  <Field label="Description" className="md:col-span-2"><Input value={selected.desc} onChange={(e)=>update(selected.id,{desc:e.target.value})} /></Field>
                </div>
              </Section>

              <Section title="Permissions">
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-white/10">
                        <th className="py-2 pr-4">Resource</th>
                        <th className="py-2 pr-4">All</th>
                        {ACTIONS.map(a => <th key={a} className="py-2 pr-4 capitalize">{a}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {RESOURCES.map(res => (
                        <tr key={res} className="border-b border-white/5">
                          <td className="py-2 pr-4 capitalize">{res}</td>
                          <td className="py-2 pr-4">
                            <input type="checkbox" checked={selected.perms.includes(`${res}.*`)} onChange={()=>toggleWild(res)} />
                          </td>
                          {ACTIONS.map(a=>{
                            const p = `${res}.${a}`;
                            return (
                              <td key={p} className="py-2 pr-4">
                                <input type="checkbox" checked={!!(selected.perms.includes(p) || selected.perms.includes(`${res}.*`) || selected.perms.includes("*"))}
                                       onChange={()=>toggle(p)} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
