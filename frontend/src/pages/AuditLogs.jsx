import React, { useEffect, useMemo, useState } from "react";
const STORE_KEY = "audit_logs_v1";
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);
const Input = (p) => <input {...p} className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className||"")} />;

const seed = () => ([
  { ts:"2025-08-16 18:02:11", actor:"karan@acme.com", action:"login.success", resource:"auth", ip:"203.0.113.10", meta:{mfa:true} },
  { ts:"2025-08-16 18:05:21", actor:"aisha@acme.com", action:"users.update", resource:"users:1234", ip:"203.0.113.3", meta:{fields:["role"]} },
  { ts:"2025-08-15 10:11:05", actor:"meera@acme.com", action:"deals.create", resource:"deals", ip:"198.51.100.5", meta:{stage:"Prospect"} },
]);

export default function AuditLogs(){
  const [rows, setRows] = useState(()=>{
    const raw = localStorage.getItem(STORE_KEY); if (raw) { try { return JSON.parse(raw); } catch{} }
    return seed();
  });
  const [filters, setFilters] = useState({ q:"", actor:"", action:"", from:"", to:"" });

  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(rows)); },[rows]);

  const filtered = useMemo(()=>{
    const q = filters.q.trim().toLowerCase();
    const inRange = (ts) => {
      const t = new Date(ts.replace(" ","T")+"Z").getTime();
      const f = filters.from ? new Date(filters.from+"T00:00:00Z").getTime() : -Infinity;
      const to = filters.to ? new Date(filters.to+"T23:59:59Z").getTime() : Infinity;
      return t>=f && t<=to;
    };
    return rows.filter(r =>
      (!q || [r.actor,r.action,r.resource,r.ip,JSON.stringify(r.meta)].some(v=>String(v||"").toLowerCase().includes(q))) &&
      (!filters.actor || r.actor===filters.actor) &&
      (!filters.action || r.action===filters.action) &&
      inRange(r.ts)
    );
  },[rows,filters]);

  const exportCSV = () => {
    const cols = ["ts","actor","action","resource","ip","meta"];
    const lines = [cols.join(",")].concat(filtered.map(r =>
      [r.ts, r.actor, r.action, `"${r.resource}"`, r.ip, `"${JSON.stringify(r.meta).replaceAll('"','""')}"`].join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "audit_logs.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Security & Compliance / Audit Logs</div>
          <h1 className="text-2xl md:text-3xl font-bold">Audit Logs</h1>
          <p className="text-sm text-gray-400 mt-1">Filter, inspect and export system activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <Section title="Filters">
        <div className="grid md:grid-cols-5 gap-3">
          <Input placeholder="Search…" value={filters.q} onChange={(e)=>setFilters({...filters,q:e.target.value})} />
          <Input placeholder="Actor email" value={filters.actor} onChange={(e)=>setFilters({...filters,actor:e.target.value})} />
          <Input placeholder="Action (e.g., deals.create)" value={filters.action} onChange={(e)=>setFilters({...filters,action:e.target.value})} />
          <Input type="date" value={filters.from} onChange={(e)=>setFilters({...filters,from:e.target.value})} />
          <Input type="date" value={filters.to} onChange={(e)=>setFilters({...filters,to:e.target.value})} />
        </div>
      </Section>

      <Section title="Results">
        <div className="rounded-xl border border-white/10 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Resource</th>
                <th className="py-2 px-3">IP</th>
                <th className="py-2 px-3">Meta</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td className="py-3 px-3 text-gray-400" colSpan={6}>No results.</td></tr>
              ) : filtered.map((r,i)=>(
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 px-3 whitespace-nowrap">{r.ts}</td>
                  <td className="py-2 px-3">{r.actor}</td>
                  <td className="py-2 px-3">{r.action}</td>
                  <td className="py-2 px-3">{r.resource}</td>
                  <td className="py-2 px-3">{r.ip}</td>
                  <td className="py-2 px-3"><code className="text-xs">{JSON.stringify(r.meta)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
