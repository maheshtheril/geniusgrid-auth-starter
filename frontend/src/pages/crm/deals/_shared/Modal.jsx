// ---------- FILE: src/pages/crm/deals/_shared/Modal.jsx ----------
import React from "react";
export function Modal({ open, title, children, onClose, onSubmit, submitLabel = 'Save' }){
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card border shadow-lg">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-sm opacity-70 hover:opacity-100" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button className="h-9 px-3 rounded-lg border" onClick={onClose}>Cancel</button>
          <button className="h-9 px-3 rounded-lg bg-primary text-primary-foreground" onClick={onSubmit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}