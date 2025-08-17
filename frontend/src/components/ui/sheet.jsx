import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

const cx = (...a) => a.filter(Boolean).join(" ");
const Ctx = createContext(null);

/** Usage (shadcn-compatible)
 * <Sheet>
 *   <SheetTrigger>Open</SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>Title</SheetTitle>
 *       <SheetDescription>Desc…</SheetDescription>
 *     </SheetHeader>
 *     …body…
 *     <SheetFooter><SheetClose>Close</SheetClose></SheetFooter>
 *   </SheetContent>
 * </Sheet>
 */

export function Sheet({ open: cOpen, onOpenChange, children }) {
  const [uOpen, setUOpen] = useState(false);
  const open = cOpen ?? uOpen;
  const setOpen = useCallback((v) => {
    if (cOpen === undefined) setUOpen(v);
    onOpenChange?.(v);
  }, [cOpen, onOpenChange]);

  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function SheetTrigger({ asChild, className = "", ...props }) {
  const { setOpen } = useContext(Ctx) || {};
  const Tag = asChild ? "span" : "button";
  return (
    <Tag
      onClick={() => setOpen?.(true)}
      className={cx(!asChild && "gg-btn h-9 px-3 rounded-lg text-sm", className)}
      {...props}
    />
  );
}

export function SheetOverlay({ className = "", onClick, ...props }) {
  const { open, setOpen } = useContext(Ctx) || {};
  if (!open) return null;
  return (
    <div
      onClick={(e) => { onClick?.(e); setOpen?.(false); }}
      className={cx("fixed inset-0 z-40 bg-black/60 backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function SheetContent({ side = "right", className = "", children, ...props }) {
  const { open } = useContext(Ctx) || {};
  if (!open) return null;

  const sideClass = {
    right:  "right-0 top-0 h-full w-[420px] max-w-[90vw] translate-x-0",
    left:   "left-0 top-0 h-full w-[420px] max-w-[90vw] translate-x-0",
    top:    "top-0 left-0 w-full max-h-[90vh]",
    bottom: "bottom-0 left-0 w-full max-h-[90vh]",
  }[side] || "right-0 top-0 h-full w-[420px]";

  const enterAnim = side === "left" ? "animate-in slide-in-from-left"
    : side === "right" ? "animate-in slide-in-from-right"
    : side === "top" ? "animate-in slide-in-from-top"
    : "animate-in slide-in-from-bottom";

  return (
    <>
      <SheetOverlay />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "fixed z-50 bg-popover text-popover-foreground border border-border shadow-2xl",
          "rounded-none", sideClass, enterAnim, className
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );
}

export function SheetHeader({ className = "", ...p }) {
  return <div className={cx("px-6 pt-5 pb-3 border-b border-border", className)} {...p} />;
}
export function SheetFooter({ className = "", ...p }) {
  return <div className={cx("px-6 py-4 border-t border-border flex justify-end gap-2", className)} {...p} />;
}
export function SheetTitle({ className = "", ...p }) {
  return <h2 className={cx("text-lg font-semibold", className)} {...p} />;
}
export function SheetDescription({ className = "", ...p }) {
  return <p className={cx("mt-1 text-sm text-muted-foreground", className)} {...p} />;
}
export function SheetClose({ asChild, className = "", ...props }) {
  const { setOpen } = useContext(Ctx) || {};
  const Tag = asChild ? "span" : "button";
  return (
    <Tag
      onClick={() => setOpen?.(false)}
      className={cx(!asChild && "gg-btn h-9 px-3 rounded-lg text-sm", className)}
      {...props}
    />
  );
}
