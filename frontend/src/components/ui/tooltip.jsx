import React, { createContext, useContext, useRef, useState, useEffect } from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

const Ctx = createContext(null);

export function TooltipProvider({ children }) { return <>{children}</>; }

export function Tooltip({ children }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  return (
    <Ctx.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </Ctx.Provider>
  );
}

export function TooltipTrigger({ asChild, className="", ...props }) {
  const { setOpen, triggerRef } = useContext(Ctx) || {};
  const Tag = asChild ? "span" : "button";
  return (
    <Tag
      ref={triggerRef}
      onMouseEnter={() => setOpen?.(true)}
      onMouseLeave={() => setOpen?.(false)}
      className={className}
      {...props}
    />
  );
}

export function TooltipContent({ side="top", className="", children, ...props }) {
  const { open, triggerRef } = useContext(Ctx) || {};
  const [pos, setPos] = useState({ top:0, left:0 });
  useEffect(() => {
    if (!open) return;
    const r = triggerRef?.current?.getBoundingClientRect?.();
    if (!r) return;
    const y = side === "top" ? r.top + window.scrollY - 8 : r.bottom + window.scrollY + 8;
    const x = r.left + window.scrollX + r.width / 2;
    setPos({ top:y, left:x });
  }, [open, side, triggerRef]);
  if (!open) return null;
  return (
    <div
      role="tooltip"
      className={cx("absolute z-50 -translate-x-1/2 rounded-md border border-border bg-popover text-popover-foreground px-2 py-1 text-xs shadow", className)}
      style={{ top: pos.top, left: pos.left }}
      {...props}
    >
      {children}
    </div>
  );
}
