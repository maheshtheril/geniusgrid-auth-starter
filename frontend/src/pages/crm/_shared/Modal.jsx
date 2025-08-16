// ---------- FILE: src/pages/crm/_shared/Modal.jsx ----------
import React, { useEffect, useRef } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  size = "lg", // sm | lg | xl
  closeOnOverlay = true,
}) {
  const panelRef = useRef(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the first focusable element
  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    if (!root) return;
    const focusable = root.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) requestAnimationFrame(() => focusable.focus());
  }, [open]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (closeOnOverlay) onClose?.(); }}
      />
      {/* Panel (gradient ring + solid card) */}
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={`w-full ${sizes[size]} relative`}>
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/30 shadow-2xl">
            <div
              ref={panelRef}
              className="rounded-2xl bg-[#0f1217] border border-white/10"
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <h2 id="modal-title" className="text-lg font-semibold">
                    {title}
                  </h2>
                  <div className="flex-1" />
                  <button
                    onClick={onClose}
                    className="h-8 px-2 text-sm rounded-lg border border-white/15 hover:bg-white/5"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                {children}
              </div>

              {/* Footer */}
              <div className="px-5 pb-4 pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="h-9 px-3 rounded-lg border border-white/15 hover:bg-white/5"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onSubmit}
                  className="h-9 px-4 rounded-lg text-white bg-gradient-to-tr from-indigo-500 to-fuchsia-500 hover:brightness-110"
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
