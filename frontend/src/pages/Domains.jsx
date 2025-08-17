import React, { useEffect, useMemo, useState } from "react";
const STORE_KEY = "admin_domains_v1";
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);
const Input = (p) => <input {...p} className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className||"")} />;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const tokenFor = (id, domain) => (btoa(`${id}:${domain}`)).replace(/=+$/,"").slice(0,24);

export default function Domains(){
  const [list, setList] = useState(()=>{
    const raw = localStorage.getItem(STORE_KEY); if (raw) { try { return JSON.parse(raw); } catch{} }
    return [{ id: uid(), domain: "acme.com", status: "verified", primary: true }];
  });
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(list)); },[list]);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(d => d.domain.toLowerCase().includes(q));
  },[list,query]);

  const add = () => { setList(prev => [{ id: uid(), domain: "example.com", status: "unverified", primary: false }, ...prev]); setMsg("Added"); setTimeout(()=>setMsg(""),900); };
  const remove = (id) => setList(prev => prev.filter(d => d.id!==id));
  const update = (id, patch) => setList(prev => prev.map(d => d.id===id ? { ...d, ...patch } : d));
  const setPrimary = (id) => setList(prev => prev.map(d => ({ ...d, primary: d.id===id })));
  const verify = (id) => update(id, { status: "verified" });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Security & Compliance / Domains</div>
          <h1 className="text-2xl md:text-3xl font-bold">Domains</h1>
          <p className="text-sm text-gray-400 mt-1">Add and verify email/web domains. Set a primary domain.</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={add}>+ Add</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-4">
          <Section title="All Domains">
            <div className="mb-3"><Input placeholder="Search…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length===0 ? <div className="p-4 text-sm text-gray-400">No domains.</div> : filtered.map(d=>{
                const txt = `gg-verification=${tokenFor(d.id, d.domain)}`;
                return (
                  <div key={d.id} className="px-3 py-2 border-b border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.domain}</div>
                        <div className="text-xs text-gray-400">{d.primary?"Primary • ":""}{d.status}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.status!=="verified" && <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>verify(d.id)}>Verify</button>}
                        {!d.primary && d.status==="verified" && <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>setPrimary(d.id)}>Make Primary</button>}
                        <button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>remove(d.id)}>✖</button>
                      </div>
                    </div>
                    {d.status!=="verified" && (
                      <div className="mt-2 text-xs bg-[#0B0D10] border border-white/10 rounded p-2 overflow-x-auto">
                        <div className="opacity-70 mb-1">Add this TXT record to your DNS:</div>
                        <code>_ggverify.{d.domain}  TXT  "{txt}"</code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="md:col-span-8">
          <Section title="Help" desc="For email sending, also configure SPF/DKIM/DMARC on your DNS.">
            <div className="text-sm text-gray-300 space-y-2">
              <div>• SPF: <code>v=spf1 include:spf.example.com ~all</code></div>
              <div>• DKIM: publish your selector public key as TXT.</div>
              <div>• DMARC: <code>v=DMARC1; p=quarantine; rua=mailto:dmarc@acme.com</code></div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
