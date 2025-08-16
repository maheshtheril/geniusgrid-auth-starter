// src/pages/crm/tasks/TaskDrawer.jsx
import React, { useEffect, useState } from "react";
import { Modal } from "../_shared/Modal";

export default function TaskDrawer({ open, onClose, task, onSave }){
  const [form, setForm] = useState(task || {});
  useEffect(()=> setForm(task || {}), [task]);
  const set=(k,v)=> setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} title={task?.id ? "Edit Task" : "New Task"} onClose={onClose} onSubmit={()=> onSave?.(form)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1"><span className="text-xs">Title</span><input className="h-9 rounded-lg border bg-background px-3" value={form.title||""} onChange={e=>set("title",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Owner</span><input className="h-9 rounded-lg border bg-background px-3" value={form.owner||""} onChange={e=>set("owner",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Due</span><input type="date" className="h-9 rounded-lg border bg-background px-3" value={form.due||""} onChange={e=>set("due",e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs">Status</span><select className="h-9 rounded-lg border bg-background px-3" value={form.status||"todo"} onChange={e=>set("status",e.target.value)}><option>todo</option><option>in-progress</option><option>done</option></select></label>
        <label className="grid gap-1 md:col-span-2"><span className="text-xs">Related</span><input className="h-9 rounded-lg border bg-background px-3" value={form.related||""} onChange={e=>set("related",e.target.value)} /></label>
      </div>
    </Modal>
  );
}
