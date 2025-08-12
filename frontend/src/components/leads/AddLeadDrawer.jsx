// src/components/leads/AddLeadDrawer.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function AddLeadDrawer({ onClose, onSuccess }) {
  const api = useLeadsApi();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    status: "new",
    stage: "new",
    owner_id: "",
  });

  // lock background scroll while drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!form.name.trim()) return setError("Name is required");
    setSaving(true);
    try {
      const created = await api.createLead({
        name: form.name.trim(),
        company_name: form.company_name.trim() || null,
        status: form.status || "new",
        stage: form.stage || "new",
        owner_id: form.owner_id || null,
      });
      onSuccess?.(created);
    } catch (err) {
      console.error(err);
      setError("Failed to create lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const el = (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-[var(--surface)]
                   border-l border-[color:var(--border)] shadow-2xl
                   animate-[slideIn_.18s_ease-out] focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="Add Lead"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
          <h2 className="text-lg font-semibold">Add Lead</h2>
          <button className="gg-btn gg-btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-4 space-y-3 overflow-auto h-[calc(100%-56px-64px)]">
          <div>
            <label className="block text-sm gg-muted mb-1">Lead name</label>
            <input className="gg-input w-full" value={form.name} onChange={update("name")} placeholder="Ada Lovelace" />
          </div>

          <div>
            <label className="block text-sm gg-muted mb-1">Company</label>
            <input className="gg-input w-full" value={form.company_name} onChange={update("company_name")} placeholder="Analytical Engines Ltd" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm gg-muted mb-1">Status</label>
              <select className="gg-input w-full" value={form.status} onChange={update("status")}>
                <option value="new">New</option>
                <option value="qualified">Qualified</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm gg-muted mb-1">Stage</label>
              <select className="gg-input w-full" value={form.stage} onChange={update("stage")}>
                <option value="new">New</option>
                <option value="prospect">Prospect</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm gg-muted mb-1">Owner (optional)</label>
            <input className="gg-input w-full" value={form.owner_id} onChange={update("owner_id")} placeholder="user id" />
          </div>

          {error && <div className="rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">{error}</div>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[color:var(--border)]">
          <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="gg-btn gg-btn-primary" type="submit" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </aside>

      {/* simple slide-in keyframes */}
      <style>{`@keyframes slideIn{from{transform:translateX(16px);opacity:.0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );

  return createPortal(el, document.body);
}
