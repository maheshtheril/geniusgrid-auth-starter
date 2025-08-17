import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* tiny class merge */
const cx = (...a) => a.filter(Boolean).join(" ");

const DialogCtx = createContext(null);

/**
 * Usage:
 * <Dialog>
 *   <DialogTrigger>Open</DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Title</DialogTitle>
 *       <DialogDescription>Desc…</DialogDescription>
 *     </DialogHeader>
 *     …body…
 *     <DialogFooter>…actions…</DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */

export function Dialog({ open: cOpen, onOpenChange, children }) {
  const [uOpen, setUOpen] = useState(false);
  const open = cOpen ?? uOpen;
  const setOpen = useCallback(
    (v) => {
      if (cOpen === undefined) setUOpen(v);
      onOpenChange?.(v);
    },
    [cOpen, onOpenChange]
  );

  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);
  return <DialogCtx.Provider value={value}>{children}</DialogCtx.Provider>;
}

export function DialogTrigger({ asChild, className = "", ...props }) {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("DialogTrigger must be used within <Dialog>.");
  const Tag = asChild ? "span" : "button";
  return (
    <Tag
      onClick={() => ctx.setOpen(true)}
      className={cx(!asChild && "gg-btn h-9 px-3 rounded-lg text-sm", className)}
      {...props}
    />
  );
}

export function DialogPortal({ children }) {
  // keep simple: render inline; React portals optional
  return <>{children}</>;
}

export function DialogOverlay({ className = "", ...props }) {
  const { open, setOpen } = useContext(DialogCtx) || {};
  if (!open) return null;
  return (
    <div
      onClick={() => setOpen(false)}
      className={cx(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0",
        className
      )}
      {...props}
    />
  );
}

export function DialogContent({ className = "", onEscapeKeyDown, ...props }) {
  const { open, setOpen } = useContext(DialogCtx) || {};
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") {
        onEscapeKeyDown?.(e);
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen, onEscapeKeyDown]);

  if (!open) return null;

  return (
    <DialogPortal>
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cx(
            "w-full max-w-lg rounded-2xl bg-popover text-popover-foreground",
            "shadow-2xl border border-border animate-in zoom-in-95 fade-in-0",
            className
          )}
          {...props}
        />
      </div>
      <DialogOverlay />
    </DialogPortal>
  );
}

export function DialogHeader({ className = "", ...props }) {
  return (
    <div className={cx("px-6 pt-5 pb-3 border-b border-border", className)} {...props} />
  );
}
export function DialogFooter({ className = "", ...props }) {
  return (
    <div
      className={cx(
        "px-6 py-4 border-t border-border flex items-center justify-end gap-2",
        className
      )}
      {...props}
    />
  );
}
export function DialogTitle({ className = "", ...props }) {
  return <h2 className={cx("text-lg font-semibold", className)} {...props} />;
}
export function DialogDescription({ className = "", ...props }) {
  return (
    <p className={cx("mt-1 text-sm text-muted-foreground", className)} {...props} />
  );
}
export function DialogClose({ asChild, className = "", ...props }) {
  const { setOpen } = useContext(DialogCtx) || {};
  const Tag = asChild ? "span" : "button";
  return (
    <Tag
      onClick={() => setOpen(false)}
      className={cx(!asChild && "gg-btn h-9 px-3 rounded-lg text-sm", className)}
      {...props}
    />
  );
}
