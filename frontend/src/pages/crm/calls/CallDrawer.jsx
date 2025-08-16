// src/pages/crm/calls/CallDrawer.jsx
import React, { useEffect, useState } from "react";
import { Modal } from "../_shared/Modal";

export default function CallDrawer({ open, onClose, call, onSave }){
  const [form, setForm] = useState(call || {});
  useEffect(()=> setForm(call || {}), [call]);
  const set=(k,v)=> setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} title={call?.id ? "Edit Call" : "Schedule Call"} onClose={onClose} onSubmit={()=> onSave?.(form)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1"><span className="text-xs">When</span><input type="datetime-local" className="h-9 rounded-lg border bg-background px-3" value={form.when||""} onChange={e=>set("when",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Owner</span><input className="h-9 rounded-lg border bg-background px-3" value={form.owner||""} onChange={e=>set("owner",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Contact</span><input className="h-9 rounded-lg border bg-background px-3" value={form.contact||""} onChange={e=>set("contact",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Company</span><input className="h-9 rounded-lg border bg-background px-3" value={form.company||""} onChange={e=>set("company",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Duration (min)</span><input type="number" className="h-9 rounded-lg border bg-background px-3" value={form.duration||""} onChange={e=>set("duration",Number(e.target.value))} /></label>
        <label className="grid gap-1"><span className="text-xs">Outcome</span><select className="h-9 rounded-lg border bg-background px-3" value={form.outcome||"scheduled"} onChange={e=>set("outcome",e.target.value)}><option>scheduled</option><option>completed</option><option>missed</option></select></label>
        <label className="grid gap-1 md:col-span-2"><span className="text-xs">Notes</span><textarea className="min-h-[90px] rounded-lg border bg-background px-3 py-2" value={form.notes||""} onChange={e=>set("notes",e.target.value)} /></label>
      </div>
    </Modal>
  );
}