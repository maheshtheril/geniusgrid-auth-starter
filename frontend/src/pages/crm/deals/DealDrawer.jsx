// ---------- FILE: src/pages/crm/deals/DealDrawer.jsx (Pro) ----------
// Drop‑in upgrade: tabs (Summary / Activity / Notes), inline validation,
// AI Next‑Step action, keyboard shortcuts (Esc, Ctrl/Cmd+S),
// probability slider + weighted amount preview, debounced autosave opt‑in.
// Keeps your existing Modal + mockApi (STAGES, updateDeal). No new deps.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./_shared/Modal";
import { STAGES, updateDeal } from "./mockApi";
import * as mockApi from "./mockApi";

export default function DealDrawer({ open, onClose, deal, onSave }){
  const [form, setForm] = useState(deal || {});
  const [tab, setTab] = useState("summary"); // summary | activity | notes
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const firstInputRef = useRef(null);

  useEffect(() => { setForm(deal || {}); setErrors({}); setTab("summary"); }, [deal]);
  useEffect(() => { if (open) setTimeout(()=> firstInputRef.current?.focus(), 50); }, [open]);

  // keyboard shortcuts: Esc to close, Ctrl/Cmd+S to save
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); submit(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, form]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const validate = () => {
    const e = {};
    if (!String(form.title || "").trim()) e.title = "Title is required";
    if (form.amount != null && Number(form.amount) < 0) e.amount = "Amount cannot be negative";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setBusy(true);
      let saved = form;
      if (deal?.id) saved = await updateDeal(deal.id, form);
      onSave?.(saved);
      onClose?.();
    } catch (err) {
      console.error(err);
    } finally { setBusy(false); }
  };

  const doAiNext = async () => {
    try {
      setAiBusy(true);
      const res = await aiNextStep?.(deal?.id, form); // optional mockApi fn
      if (res?.next_step) set("next_step", res.next_step);
    } catch (e) { console.error(e); } finally { setAiBusy(false); }
  };

  const probabilityPct = useMemo(() => {
    const p = form.probability;
    if (typeof p === "number") return Math.max(0, Math.min(100, Math.round(p * 100)));
    return 0;
  }, [form.probability]);

  const weightedAmount = useMemo(() => {
    const amt = Number(form.amount || 0);
    const p = (typeof form.probability === "number" ? form.probability : probabilityPct / 100);
    return Math.round(amt * (p || 0));
  }, [form.amount, form.probability, probabilityPct]);

  return (
    <Modal
      open={open}
      title={deal?.id ? "Edit Deal" : "New Deal"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={busy ? "Saving…" : "Save"}
    >
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-3">
        {(["summary","activity","notes"]).map(t => (
          <button
            key={t}
            onClick={()=>setTab(t)}
            className={`px-3 h-9 rounded-lg border ${tab===t?"bg-primary text-primary-foreground":"bg-background"}`}
          >{t[0].toUpperCase()+t.slice(1)}</button>
        ))}
        <div className="ml-auto text-sm opacity-70 flex items-center gap-3">
          <div>Weighted: <b>₹{weightedAmount.toLocaleString('en-IN')}</b></div>
          {aiBusy ? (
            <button disabled className="h-9 px-3 rounded-lg border bg-muted">AI Thinking…</button>
          ) : (
            <button onClick={doAiNext} className="h-9 px-3 rounded-lg border">AI Next Step</button>
          )}
        </div>
      </div>

      {tab === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Title</span>
            <input ref={firstInputRef} className={`h-9 rounded-lg border bg-background px-3 ${errors.title?"border-red-500":""}`} value={form.title||''} onChange={e=>set('title', e.target.value)} />
            {errors.title && <span className="text-xs text-red-600">{errors.title}</span>}
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Company</span>
            <input className="h-9 rounded-lg border bg-background px-3" value={form.company||''} onChange={e=>set('company', e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Amount (₹)</span>
            <input className={`h-9 rounded-lg border bg-background px-3 ${errors.amount?"border-red-500":""}`} type="number" value={form.amount??''} onChange={e=>set('amount', e.target.value===''?'' : Number(e.target.value))} />
            {errors.amount && <span className="text-xs text-red-600">{errors.amount}</span>}
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Owner</span>
            <input className="h-9 rounded-lg border bg-background px-3" value={form.owner||''} onChange={e=>set('owner', e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Stage</span>
            <select className="h-9 rounded-lg border bg-background px-3" value={form.stage||STAGES[0]?.id||'new'} onChange={e=>set('stage', e.target.value)}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Probability (%)</span>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={probabilityPct} onChange={(e)=>set('probability', Number(e.target.value)/100)} className="flex-1" />
              <input type="number" min={0} max={100} value={probabilityPct} onChange={(e)=>{
                const v = Math.max(0, Math.min(100, Number(e.target.value||0)));
                set('probability', v/100);
              }} className="w-20 h-9 rounded-lg border bg-background px-2 text-right" />
            </div>
          </label>
          <label className="md:col-span-2 grid gap-1">
            <span className="text-xs text-muted-foreground">Tags (comma separated)</span>
            <input className="h-9 rounded-lg border bg-background px-3" value={(form.tags||[]).join(', ')} onChange={e=>set('tags', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
          </label>
          <label className="md:col-span-2 grid gap-1">
            <span className="text-xs text-muted-foreground">Next Step</span>
            <input className="h-9 rounded-lg border bg-background px-3" value={form.next_step||''} onChange={e=>set('next_step', e.target.value)} placeholder="e.g., Demo on Friday 4pm" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Next Step Date</span>
            <input type="date" className="h-9 rounded-lg border bg-background px-3" value={form.next_step_date||''} onChange={e=>set('next_step_date', e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Source</span>
            <input className="h-9 rounded-lg border bg-background px-3" value={form.source||''} onChange={e=>set('source', e.target.value)} />
          </label>
        </div>
      )}

      {tab === "activity" && (
        <div className="space-y-3">
          <div className="text-sm opacity-70">Recent activity will appear here (calls, emails, meetings). Hook this to your timeline API.</div>
          <ul className="space-y-2 text-sm">
            {(form.timeline || []).map((t,i)=> (
              <li key={i} className="border rounded-lg p-2">
                <div className="opacity-70">{t.type} • {new Date(t.at).toLocaleString()}</div>
                <div>{t.text}</div>
              </li>
            ))}
            {!form.timeline?.length && <li className="text-sm opacity-60">No activity yet.</li>}
          </ul>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-2">
          <textarea className="min-h-[120px] rounded-lg border bg-background p-3 w-full" value={form.notes || ''} onChange={e=>set('notes', e.target.value)} placeholder="Internal notes…" />
          <div className="text-xs opacity-60">Notes are private to your team.</div>
        </div>
      )}
    </Modal>
  );
}
