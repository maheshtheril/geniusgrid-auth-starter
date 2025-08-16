// src/pages/crm/calls/CallsList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Toolbar } from "../_shared/Toolbar";
import CallDrawer from "./CallDrawer";
import { listCalls, createCall, updateCall } from "./mockApi";

export default function CallsList(){
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");

  useEffect(()=>{ (async()=> setRows(await listCalls()))(); },[]);

  const filtered = useMemo(()=> rows.filter(r => !q || r.contact.toLowerCase().includes(q.toLowerCase()) || r.company.toLowerCase().includes(q.toLowerCase())), [rows,q]);

  const save = async (data)=>{
    if (editing) {
      const saved = await updateCall(editing.id, data);
      setRows(prev=> prev.map(r=> r.id===saved.id ? saved : r));
    } else {
      const created = await createCall(data);
      setRows(prev=> [created, ...prev]);
    }
    setOpen(false); setEditing(null);
  };

  const pill = (s)=> {
    const map = { completed:"bg-green-500/20 text-green-300", scheduled:"bg-amber-500/20 text-amber-300", missed:"bg-red-500/20 text-red-300" };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${map[s]||"bg-white/10"}`}>{s}</span>;
  };

  return (
    <div>
      <Toolbar title="Calls" onAdd={()=>{setEditing(null); setOpen(true);}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search contact/company…" className="h-9 px-3 rounded-lg border bg-background" />
      </Toolbar>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40"><tr>
            {['When','Contact','Company','Owner','Duration','Outcome','Sentiment','Actions'].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length===0 && (<tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No calls</td></tr>)}
            {filtered.map(r=> (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.when}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.contact}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.company}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.owner}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.duration}m</td>
                <td className="px-3 py-2 whitespace-nowrap">{pill(r.outcome)}</td>
                <td className="px-3 py-2 whitespace-nowrap capitalize">{r.sentiment}</td>
                <td className="px-3 py-2 whitespace-nowrap"><button className="h-8 px-2 rounded-lg border text-xs" onClick={()=>{setEditing(r); setOpen(true);}}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CallDrawer open={open} call={editing} onClose={()=>{setOpen(false); setEditing(null);}} onSave={save} />
    </div>
  );
}