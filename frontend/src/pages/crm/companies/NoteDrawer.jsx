// ---------- FILE: src/pages/crm/companies/NoteDrawer.jsx ----------
import React, { useEffect, useState } from "react";
import { Modal } from "../_shared/Modal";

export default function NoteDrawer({ open, onClose, note, onSave }){
  const [form, setForm] = useState(note || {});
  useEffect(()=> setForm(note || {}), [note]);
  return (
    <Modal open={open} title="Add Note" onClose={onClose} onSubmit={()=> onSave?.(form)} submitLabel="Save">
      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Note</span>
          <textarea className="min-h-[120px] rounded-lg border bg-background px-3 py-2" value={form.text||''} onChange={e=> setForm(p=>({...p, text: e.target.value}))} />
        </label>
      </div>
    </Modal>
  );
}