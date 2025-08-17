// ---------- FILE: src/pages/admin/_shared/DrawerForm.jsx ----------
import React, { useEffect } from "react";

export default function DrawerForm({ title, open, onClose, children, footer }){
  useEffect(()=>{
    function esc(e){ if(e.key === "Escape") onClose?.(); }
    if(open) document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-40 ${open?"":"pointer-events-none"}`}>
      {/* backdrop */}
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${open?"opacity-100":"opacity-0"}`} onClick={onClose} />
      {/* panel */}
      <div className={`absolute top-0 right-0 h-full w-full max-w-xl gg-surface border-l transition-transform ${open?"translate-x-0":"translate-x-full"}`}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="gg-btn h-8 px-3">Close</button>
        </div>
        <div className="p-5 overflow-auto h-[calc(100%-112px)]">{children}</div>
        <div className="p-5 border-t flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

