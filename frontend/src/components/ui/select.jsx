import React, { useState, useMemo, useRef, useEffect } from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export function Select({ value:cv, onValueChange, defaultValue, children }) {
  const [u, setU] = useState(defaultValue);
  const value = cv ?? u;
  const set = (v) => { if (cv === undefined) setU(v); onValueChange?.(v); };
  return React.Children.map(children, ch => React.isValidElement(ch) ? React.cloneElement(ch, { __selectValue:value, __setSelect:set }) : ch);
}

export function SelectTrigger({ className="", children, __selectValue, __setSelect, ...props }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o=>!o)}
        className={cx("gg-input h-9 px-3 rounded-lg w-full text-left flex items-center justify-between", className)}
        {...props}
      >
        <span className="truncate">{children}</span>
        <span className="opacity-60">▾</span>
      </button>
      {open && (
        <div
          className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-popover shadow-xl p-1"
          onMouseLeave={() => setOpen(false)}
        >
          {React.Children.map(props.childrenList || props.children, ch =>
            React.isValidElement(ch) ? React.cloneElement(ch, { __selectClose: () => setOpen(false), __setSelect }) : ch
          )}
        </div>
      )}
    </div>
  );
}

export function SelectValue({ placeholder, value, __selectValue }) {
  return <span>{value ?? __selectValue ?? placeholder}</span>;
}

export function SelectContent({ className="", children, ...props }) {
  return <div className={cx("max-h-64 overflow-auto", className)} {...props}>{children}</div>;
}

export function SelectItem({ value, className="", children, __setSelect, __selectClose, ...props }) {
  return (
    <div
      role="option"
      onClick={() => { __setSelect?.(value); __selectClose?.(); }}
      className={cx("px-3 py-2 rounded-lg cursor-pointer hover:bg-muted/60", className)}
      {...props}
    >
      {children ?? String(value)}
    </div>
  );
}
