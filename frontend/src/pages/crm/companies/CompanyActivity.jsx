// ---------- FILE: src/pages/crm/companies/CompanyActivity.jsx ----------
import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listCompanyActivity, addCompanyNote } from "./mockApi";
import NoteDrawer from "./NoteDrawer";

function Item({ it }){
  const chip = {
    note: "bg-white/10",
    call: "bg-amber-500/20 text-amber-300",
    task: "bg-blue-500/20 text-blue-300",
    deal: "bg-purple-500/20 text-purple-300",
  }[it.kind] || "bg-white/10";
  return (
    <div className="p-3 rounded-xl border bg-background">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`px-2 py-0.5 rounded-full ${chip}`}>{it.kind}</span>
        <span>{it.ts}</span>
        <span>•</span>
        <span>by {it.by}</span>
      </div>
      <div className="text-sm mt-1 whitespace-pre-wrap">{it.text}</div>
    </div>
  );
}

export default function CompanyActivity(){
  const { company } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(()=> { (async()=> setRows(await listCompanyActivity(company.id)))(); }, [company.id]);

  const save = async (data)=> {
    const saved = await addCompanyNote(company.id, { text: data.text, by: 'You' });
    setRows(prev => [saved, ...prev]);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Activity Timeline</div>
        <button className="h-9 px-3 rounded-lg border text-sm" onClick={()=> setOpen(true)}>Add Note</button>
      </div>
      {rows.length===0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
      {rows.map(it => <Item key={it.id} it={it} />)}
      <NoteDrawer open={open} onClose={()=> setOpen(false)} onSave={save} />
    </div>
  );
}