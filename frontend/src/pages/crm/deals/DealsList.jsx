// ---------- FILE: src/pages/crm/deals/DealsList.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { listDeals } from "./mockApi";

function th(c){ return <th key={c} className="px-3 py-2 font-medium text-left">{c}</th>; }

export default function DealsList(){
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");

  useEffect(()=>{ (async()=> setRows(await listDeals()))(); },[]);

  const owners = useMemo(()=> Array.from(new Set(rows.map(r=>r.owner))).filter(Boolean),[rows]);
  const stages = useMemo(()=> Array.from(new Set(rows.map(r=>r.stage))).filter(Boolean),[rows]);

  const filtered = useMemo(()=> rows.filter(r =>
    (!q || r.title.toLowerCase().includes(q.toLowerCase()) || r.company.toLowerCase().includes(q.toLowerCase())) &&
    (!stage || r.stage === stage) &&
    (!owner || r.owner === owner)
  ), [rows, q, stage, owner]);

  return (
    <div>
      <Toolbar title="Deal List" onFilter={()=>{}}>
        <div className="hidden md:flex items-center gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title/company…" className="h-9 px-3 rounded-lg border bg-background" />
          <select value={stage} onChange={e=>setStage(e.target.value)} className="h-9 px-3 rounded-lg border bg-background">
            <option value="">All stages</option>
            {stages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={owner} onChange={e=>setOwner(e.target.value)} className="h-9 px-3 rounded-lg border bg-background">
            <option value="">All owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </Toolbar>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {['Title','Company','Amount','Owner','Stage','Next Step'].map(th)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No deals match your filters</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.title}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.company}</td>
                <td className="px-3 py-2 whitespace-nowrap">₹{r.amount.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.owner}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.stage}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.next_step || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

