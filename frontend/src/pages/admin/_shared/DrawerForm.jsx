// src/pages/admin/_shared/DrawerForm.jsx
import React, { useEffect } from "react";

export default function DrawerForm({
  title = "",
  open = false,
  onClose = () => {},
  onSubmit,               // optional: invoked when pressing Ctrl+Enter
  footer,                 // custom footer buttons; if not provided, shows default Cancel/Save
  size = "md",
  children,
}) {
  useEffect(() => {
    const onEsc = (e) => (e.key === "Escape" && open) && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const W = size === "lg" ? "max-w-[720px]" : size === "sm" ? "max-w-[420px]" : "max-w-[560px]";

  return (
    <div
      aria-hidden={!open}
      className={[
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none"
      ].join(" ")}
    >
      {/* Backdrop */}
      <div
        className={[
          "absolute inset-0 transition-opacity",
          open ? "opacity-100 bg-black/50" : "opacity-0"
        ].join(" ")}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={[
          "absolute right-0 top-0 h-full bg-[#0B0D10] border-l border-white/10 shadow-2xl",
          "w-full", W,
          "grid grid-rows-[auto_1fr_auto]",
          "transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        ].join(" ")}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="px-2 py-1 rounded-md hover:bg-white/10" onClick={onClose}>✕</button>
        </header>

        {/* Body (scrollable) */}
        <div className="overflow-auto p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit?.();
            }}
          >
            {children}
            {/* Hidden submit so Enter works in inputs */}
            <button type="submit" className="hidden" />
          </form>
        </div>

        {/* Footer (sticky) */}
        <footer className="px-5 py-3 border-t border-white/10 bg-[#0B0D10]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0B0D10]/70">
          {footer ? (
            <div className="flex items-center justify-end gap-2">{footer}</div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button className="gg-btn" onClick={onClose}>Cancel</button>
              <button className="gg-btn-primary" onClick={onSubmit}>Save</button>
            </div>
          )}
          <div className="text-xs text-white/50 mt-1">Tip: Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to save</div>
        </footer>
      </aside>
    </div>
  );
}
