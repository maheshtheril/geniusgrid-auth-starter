import React, { useMemo, useState } from "react";
const seed = () => ([
  { ts:"2025-08-16 18:02:11", level:"info",  message:"Server started" },
  { ts:"2025-08-16 18:05:21", level:"warn",  message:"Slow query detected" },
  { ts:"2025-08-16 19:11:05", level:"error", message:"Webhook failed (500)" },
]);
export default function SystemLogs(){
  const [rows] = useState(seed());
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState("");
  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase();
    return rows.filter(r =>
      (!lvl || r.level===lvl) &&
      (!s || `${r.ts} ${r.level} ${r.message}`.toLowerCase().includes(s))
    );
  },[rows,q,lvl]);
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / System Logs</div><h1 className="text-2xl md:text-3xl font-bold">System Logs</h1></div>
      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <input className="bg-[#0B0D10] border border-white/10 rounded px-3 py-2" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}/>
          <select className="bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={lvl} onChange={e=>setLvl(e.target.value)}>
            <option value="">All levels</option><option>info</option><option>warn</option><option>error</option>
          </select>
        </div>
        <div className="rounded border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">Time</th><th className="p-2">Level</th><th className="p-2">Message</th></tr></thead>
            <tbody>{filtered.length===0 ? <tr><td className="p-3 text-gray-400" colSpan={3}>No results.</td></tr> :
              filtered.map((r,i)=><tr key={i} className="border-b border-white/5"><td className="p-2">{r.ts}</td><td className="p-2">{r.level}</td><td className="p-2">{r.message}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
