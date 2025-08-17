import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** tiny class merge */
const cx = (...a) => a.filter(Boolean).join(" ");

const Ctx = createContext(null);

export function DropdownMenu({ children, open: cOpen, onOpenChange }) {
  const [uOpen, setUOpen] = useState(false);
  const open = cOpen ?? uOpen;
  const setOpen = useCallback(
    (v) => {
      if (cOpen === undefined) setUOpen(v);
      onOpenChange?.(v);
    },
    [cOpen, onOpenChange]
  );
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

  const value = useMemo(
    () => ({ open, setOpen, triggerRef, contentRef }),
    [open, setOpen]
  );

  // basic outside-click close
  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      const t = triggerRef.current;
      const c = contentRef.current;
      if (t?.contains(e.target) || c?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, setOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function DropdownMenuTrigger({ asChild, className = "", ...props }) {
  const { open, setOpen, triggerRef } = useContext(Ctx) || {};
  if (!triggerRef) throw new Error("DropdownMenuTrigger must be inside <DropdownMenu>.");

  const TriggerTag = asChild ? "span" : "button";
  return (
    <TriggerTag
      ref={triggerRef}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => {
        e.preventDefault();
        setOpen(!open);
      }}
      className={cx(
        !asChild &&
          "gg-btn h-9 px-3 rounded-lg text-sm inline-flex items-center gap-2",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuContent({
  align = "start",
  sideOffset = 6,
  className = "",
  style,
  ...props
}) {
  const { open, triggerRef, contentRef } = useContext(Ctx) || {};
  if (!contentRef) throw new Error("DropdownMenuContent must be inside <DropdownMenu>.");

  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0 });

  useEffect(() => {
    if (!open) return;
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const left =
      align === "end" ? r.right : align === "center" ? r.left + r.width / 2 : r.left;
    setPos({
      top: r.bottom + window.scrollY + sideOffset,
      left:
        (align === "end" ? r.right - 8 : align === "center" ? r.left : r.left) +
        window.scrollX,
      minWidth: r.width,
    });
  }, [open, align, sideOffset, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      className={cx(
        "absolute z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
        "p-1 min-w-[12rem]",
        className
      )}
      style={{ top: pos.top, left: pos.left, ...style }}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ inset, className = "", ...props }) {
  return (
    <div
      className={cx(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className = "", ...props }) {
  return (
    <div
      role="separator"
      className={cx("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export function DropdownMenuGroup({ className = "", ...props }) {
  return <div className={cx("py-0.5", className)} role="group" {...props} />;
}

export function DropdownMenuItem({
  inset,
  disabled,
  className = "",
  onSelect,
  onClick,
  ...props
}) {
  return (
    <div
      role="menuitem"
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) return;
        onSelect?.(e);
        onClick?.(e);
      }}
      className={cx(
        "px-2 py-1.5 rounded-lg text-sm cursor-pointer select-none",
        inset && "pl-8",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-muted/60 active:bg-muted",
        className
      )}
      {...props}
    />
  );
}

/* --- Optional submenus (simple) --- */
const SubCtx = createContext(null);

export function DropdownMenuSub({ children }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const value = useMemo(() => ({ open, setOpen, triggerRef, contentRef }), [open]);
  return <SubCtx.Provider value={value}>{children}</SubCtx.Provider>;
}

export function DropdownMenuSubTrigger({ className = "", children, ...props }) {
  const { open, setOpen, triggerRef } = useContext(SubCtx) || {};
  if (!triggerRef) throw new Error("DropdownMenuSubTrigger must be inside DropdownMenuSub.");
  return (
    <div
      role="menuitem"
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={cx(
        "px-2 py-1.5 rounded-lg text-sm cursor-pointer select-none hover:bg-muted/60",
        "flex items-center justify-between gap-2",
        className
      )}
      {...props}
    >
      {children}
      <span className="opacity-60">›</span>
    </div>
  );
}

export function DropdownMenuSubContent({ className = "", style, ...props }) {
  const { open, triggerRef, contentRef } = useContext(SubCtx) || {};
  if (!contentRef) throw new Error("DropdownMenuSubContent must be inside DropdownMenuSub.");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!open) return;
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    setPos({ top: r.top + window.scrollY, left: r.right + window.scrollX + 8 });
  }, [open, triggerRef]);
  if (!open) return null;
  return (
    <div
      ref={contentRef}
      role="menu"
      className={cx(
        "absolute z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-1 min-w-[10rem]",
        className
      )}
      style={{ top: pos.top, left: pos.left, ...style }}
      {...props}
    />
  );
}

/* --- Checkbox & Radio variants (lightweight) --- */
export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
  className = "",
  ...props
}) {
  const [u, setU] = useState(!!checked);
  const is = checked ?? u;
  return (
    <DropdownMenuItem
      className={cx("flex items-center gap-2", className)}
      onClick={() => {
        const v = !is;
        if (checked === undefined) setU(v);
        onCheckedChange?.(v);
      }}
      {...props}
    >
      <span
        className={cx(
          "inline-block w-4 h-4 rounded border border-border",
          is ? "bg-primary" : "bg-transparent"
        )}
      />
      {children}
    </DropdownMenuItem>
  );
}

const RadioCtx = createContext({ value: undefined, set: () => {} });

export function DropdownMenuRadioGroup({ value, onValueChange, children }) {
  const [u, setU] = useState(value);
  const v = value ?? u;
  const set = (nv) => {
    if (value === undefined) setU(nv);
    onValueChange?.(nv);
  };
  const ctx = useMemo(() => ({ value: v, set }), [v]);
  return <RadioCtx.Provider value={ctx}>{children}</RadioCtx.Provider>;
}

export function DropdownMenuRadioItem({ value, children, className = "", ...props }) {
  const { value: v, set } = useContext(RadioCtx);
  const active = v === value;
  return (
    <DropdownMenuItem
      className={cx("flex items-center gap-2", className)}
      onClick={() => set(value)}
      {...props}
    >
      <span
        className={cx(
          "inline-block w-4 h-4 rounded-full border border-border",
          active && "bg-primary"
        )}
      />
      {children}
    </DropdownMenuItem>
  );
}
