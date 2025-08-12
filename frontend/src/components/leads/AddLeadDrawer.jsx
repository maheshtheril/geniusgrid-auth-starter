// src/components/leads/AddLeadDrawer.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLeadsApi from "@/hooks/useLeadsApi";

const INIT = {
  name: "",
  company_name: "",
  status: "new",
  stage: "new",
  owner_id: "",
};

export default function AddLeadDrawer({ onClose, onSuccess, prefill }) {
  const api = useLeadsApi();

  // Always start from a fresh object (prefill optional)
  const [form, setForm] = useState({ ...INIT, ...(prefill || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstInputRef = useRef(null);

  // Lock scroll, focus first input, close on ESC
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);

    // focus next tick
    const t = setTimeout(() => firstInputRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
      clearTimeout(t);
    };
  }, [onClose]);

  // If parent ever passes new prefill, reset form (defensive)
  useEffect(() => {
    setForm({ ...INIT, ...(prefill || {}) });
  }, [prefill]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    const name = form.name.trim();
    if (!name) return setError("Name is required");

    setSaving(true);
    try {
      const created = await api.createLead({
        name,
        company_name: form.company_name.trim() || null,
        status: form.status || "new",
        stage: form.stage || "new",
        owner_id: form.owner_id || null,
      });

      // brief success pulse before close (nice micro-interaction)
      const btn = document.getElementById("addlead-save");
      if (btn) {
        btn.classList.add("success-pulse");
        setTimeout(() => onSuccess?.(created), 220);
      } else {
        onSuccess?.(created);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const drawer = (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-fadeIn"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[520px]
                   bg-[var(--surface)] border-l border-[color:var(--border)] shadow-2xl
                   animate-slideIn will-change-transform"
        role="dialog"
        aria-modal="true"
        aria-label="Add Lead"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
          <div>
            <h2 className="text-lg font-semibold">Create new lead</h2>
            <div className="gg-muted text-xs">Quick add • only the name is required</div>
          </div>
          <button className="gg-btn gg-btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-4 space-y-3 overflow-auto h-[calc(100%-56px-64px)]">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm gg-muted mb-1">Lead name *</label>
              <input
                ref={firstInputRef}
                className="gg-input w-full"
                value={form.name}
                onChange={update("name")}
                placeholder="Ada Lovelace"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm gg-muted mb-1">Company</label>
              <input
                className="gg-input w-full"
                value={form.company_name}
                onChange={update("company_name")}
                placeholder="Analytical Engines Ltd"
                autoComplete="off"
              />
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
              <input
                className="gg-input w-full"
                value={form.owner_id}
                onChange={update("owner_id")}
                placeholder="user id"
                autoComplete="off"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[color:var(--border)]">
          <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            id="addlead-save"
            className="gg-btn gg-btn-primary"
            type="submit"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </aside>

      {/* Keyframes (no extra deps) */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn {
          0%   { transform: translateX(24px); opacity: .0; }
          60%  { transform: translateX(-2px); opacity: 1; }
          100% { transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn .18s ease-out both; }
        .animate-slideIn { animation: slideIn .22s cubic-bezier(.2,.8,.2,1) both; }

        /* Micro success pulse on save */
        .success-pulse {
          position: relative;
        }
        .success-pulse::after {
          content: '';
          position: absolute; inset: -3px;
          border-radius: 12px;
          box-shadow: 0 0 0 0 var(--ring);
          animation: pulse .22s ease-out 1;
        }
        @keyframes pulse {
          from { box-shadow: 0 0 0 0 var(--ring); }
          to   { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
        }
      `}</style>
    </div>
  );

  return createPortal(drawer, document.body);
}
