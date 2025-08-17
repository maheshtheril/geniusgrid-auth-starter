import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

/** Tiny clsx */
const cx = (...a) => a.filter(Boolean).join(" ");

/**
 * API compatible with shadcn/ui Tabs:
 * <Tabs defaultValue="users" value={...} onValueChange={...}>
 *   <TabsList>
 *     <TabsTrigger value="users">Users</TabsTrigger>
 *     <TabsTrigger value="roles">Roles</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="users">...</TabsContent>
 *   <TabsContent value="roles">...</TabsContent>
 * </Tabs>
 */

const TabsCtx = createContext(null);

export function Tabs({
  value: controlledValue,
  onValueChange,
  defaultValue,
  className = "",
  children,
  ...rest
}) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = isControlled ? controlledValue : uncontrolled;

  const setValue = useCallback(
    (v) => {
      if (!isControlled) setUncontrolled(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange]
  );

  const ctx = useMemo(() => ({ value, setValue }), [value, setValue]);

  return (
    <TabsCtx.Provider value={ctx}>
      <div className={cx("w-full", className)} {...rest}>
        {children}
      </div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ className = "", children, ...rest }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-1 rounded-xl p-1 bg-muted/40 border border-border",
        className
      )}
      role="tablist"
      {...rest}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className = "", children, ...rest }) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>.");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cx(
        "px-3 h-9 rounded-lg text-sm transition-all",
        active
          ? "bg-background shadow border border-border"
          : "text-muted-foreground hover:bg-muted/50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = "", children, ...rest }) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>.");
  const active = ctx.value === value;
  return (
    <div
      role="tabpanel"
      hidden={!active}
      className={cx(active ? "animate-in fade-in-0 zoom-in-95" : "", className)}
      {...rest}
    >
      {active ? children : null}
    </div>
  );
}
