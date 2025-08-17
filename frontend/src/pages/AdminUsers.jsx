import React, { useEffect, useMemo, useState } from "react";

const STORE_KEY = "admin_users_v1";

const Field = ({ label, children, className = "" }) => (
  <label className={"block " + className}>
    <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</span>
    {children}
  </label>
);
const Input = (p) => (
  <input {...p}
    className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className || "")}
  />
);
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5">
      <div className="text-base md:text-lg font-semibold">{title}</div>
      {desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}
    </div>
    {children}
  </section>
);
const ROLES = ["Admin", "Manager", "SalesRep", "Support", "Viewer"];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const seed = () => ([
  { id: uid(), name: "Aisha Rao", email: "aisha@acme.com", role: "Admin",   active: true,  mfa: true,  last_login: "2025-08-12 09:20", teams: "HQ" },
  { id: uid(), name: "Karan Shah", email: "karan@acme.com", role: "Manager",active: true,  mfa: false, last_login: "2025-08-16 18:02", teams: "West" },
  { id: uid(), name: "Meera Joshi",email: "meera@acme.com", role: "SalesRep",active: true, mfa: true,  last_login: "2025-08-15 11:05", teams: "South" },
]);

export default function AdminUsers(){
  const [list, setList] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch{} }
    return seed();
  });
  const [selectedId, setSelectedId] = useState(() => list[0]?.id || null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(u =>
      [u.name, u.email, u.role, u.teams].some(v => String(v||"").toLowerCase().includes(q))
    );
  }, [list, query]);

  const selected = list.find(u => u.id === selectedId) || null;

  const addUser = () => {
    const n = { id: uid(), name: "New User", email: "", role: "Viewer", active: true, mfa: false, last_login: "-", teams: "" };
    setList(prev => [n, ...prev]);
    setSelectedId(n.id);
    toast("Added");
  };
  const duplicate = (id) => {
    const u = list.find(x => x.id === id); if (!u) return;
    const copy = { ...u, id: uid(), email: "", name: u.name + " (Copy)", last_login: "-" };
    setList(prev => [copy, ...prev]); setSelectedId(copy.id); toast("Duplicated");
  };
  const remove = (id) => {
    const next = list.filter(x => x.id !== id);
    setList(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    toast("Removed");
  };
  const update = (id, patch) => setList(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));

  const invite = (id) => { void id; toast("Invite sent (mock)"); };
  const resetPwd = (id) => { void id; toast("Password reset email sent (mock)"); };

  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(""), 900); };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Access Control / Users</div>
          <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
          <p className="text-sm text-gray-400 mt-1">Invite users, assign roles and manage status/MFA.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addUser}>+ Add</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-5">
          <Section title="All Users">
            <div className="mb-3"><Input placeholder="Search…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length===0 ? <div className="p-4 text-sm text-gray-400">No matches.</div> : filtered.map(u=>{
                const active = u.id===selectedId;
                return (
                  <div key={u.id}
                       className={["px-3 py-2 border-b border-white/5 cursor-pointer", active?"bg-white/10":"hover:bg-white/5"].join(" ")}
                       onClick={()=>setSelectedId(u.id)}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className="text-xs text-gray-400 truncate">{u.email || "—"} • {u.role}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.mfa && <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200">MFA</span>}
                        {!u.active && <span className="text-[11px] px-2 py-0.5 rounded bg-red-600/30 text-red-300">Inactive</span>}
                        <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={(e)=>{e.stopPropagation(); duplicate(u.id);}}>Copy</button>
                        <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={(e)=>{e.stopPropagation(); remove(u.id);}}>✖</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="md:col-span-7">
          {!selected ? (
            <Section title="Editor"><div className="text-sm text-gray-400">Select a user.</div></Section>
          ) : (
            <>
              <Section title="Identity & Access">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Name"><Input value={selected.name} onChange={(e)=>update(selected.id,{name:e.target.value})} /></Field>
                  <Field label="Email"><Input type="email" value={selected.email} onChange={(e)=>update(selected.id,{email:e.target.value})} /></Field>
                  <Field label="Role">
                    <select className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                            value={selected.role} onChange={(e)=>update(selected.id,{role:e.target.value})}>
                      {ROLES.map(r=> <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Teams (comma separated)"><Input value={selected.teams||""} onChange={(e)=>update(selected.id,{teams:e.target.value})} /></Field>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                    <input type="checkbox" checked={!!selected.mfa} onChange={(e)=>update(selected.id,{mfa:e.target.checked})} />
                    <span className="text-sm">MFA enabled</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                    <input type="checkbox" checked={!!selected.active} onChange={(e)=>update(selected.id,{active:e.target.checked})} />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={()=>invite(selected.id)}>Send Invite</button>
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={()=>resetPwd(selected.id)}>Reset Password</button>
                </div>
                <div className="text-xs text-gray-400 mt-3">Last login: {selected.last_login || "—"}</div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
