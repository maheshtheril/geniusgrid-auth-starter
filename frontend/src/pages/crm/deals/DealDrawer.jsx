// ---------- FILE: src/pages/crm/deals/DealDrawer.jsx ----------
import React, { useEffect, useState } from "react";
import { Modal } from "./_shared/Modal";
import { STAGES, updateDeal } from "./mockApi";

export default function DealDrawer({ open, onClose, deal, onSave }){
  const [form, setForm] = useState(deal || {});
  useEffect(() => setForm(deal || {}), [deal]);

  const set = (k,v) => setForm(prev => ({...prev, [k]: v}));
  const submit = async () => {
    if (!deal?.id) return onSave?.(form);
    const saved = await updateDeal(deal.id, form);
    onSave?.(saved);
  };

  return (
    <Modal open={open} title={deal?.id ? "Edit Deal" : "New Deal"} onClose={onClose} onSubmit={submit} submitLabel="Save">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Title</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.title||''} onChange={e=>set('title', e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Company</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.company||''} onChange={e=>set('company', e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Amount (₹)</span>
          <input className="h-9 rounded-lg border bg-background px-3" type="number" value={form.amount||''} onChange={e=>set('amount', Number(e.target.value))} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Owner</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.owner||''} onChange={e=>set('owner', e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Stage</span>
          <select className="h-9 rounded-lg border bg-background px-3" value={form.stage||'new'} onChange={e=>set('stage', e.target.value)}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Next Step</span>
          <input className="h-9 rounded-lg border bg-background px-3" value={form.next_step||''} onChange={e=>set('next_step', e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
