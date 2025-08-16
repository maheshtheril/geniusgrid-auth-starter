// src/pages/crm/contacts/ContactDrawer.jsx
import React, { useEffect, useState } from "react";
import { Modal } from "../_shared/Modal";

export default function ContactDrawer({ open, onClose, contact, onSave }){
  const [form, setForm] = useState(contact || {});
  useEffect(()=> setForm(contact || {}), [contact]);
  const set=(k,v)=> setForm(p=>({...p,[k]:v}));
  return (
    <Modal open={open} title={contact?.id ? "Edit Contact" : "New Contact"} onClose={onClose} onSubmit={()=> onSave?.(form)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Name</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.name||""} onChange={e=>set("name",e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Company</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.company||""} onChange={e=>set("company",e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Email</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.email||""} onChange={e=>set("email",e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Phone</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.phone||""} onChange={e=>set("phone",e.target.value)} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs text-muted-foreground">Title / Role</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.title||""} onChange={e=>set("title",e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
