import React, { createContext, useContext, useMemo, useState } from "react";

/**
 * Minimal emulation of shadcn/ui Select that keeps your JSX tree working:
 * <Select value onValueChange>
 *   <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="...">Label</SelectItem>
 *   </SelectContent>
 * </Select>
 *
 * Internally renders a native <select> for simplicity.
 */

const Ctx = createContext({ val: "", set: () => {} });

export function Select({ value, defaultValue = "", onValueChange, children }) {
  const [val, setVal] = useState(value ?? defaultValue);
  const set = (v) => {
    setVal(v);
    onValueChange?.(v);
  };
  const api = useMemo(() => ({ val, set }), [val]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function SelectTrigger({ className = "", children, ...props }) {
  // purely presentational wrapper in this stub
  return (
    <div className={`relative inline-flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SelectValue({ placeholder }) {
  const { val } = useContext(Ctx) || {};
  return <span>{val || placeholder || ""}</span>;
}

export function SelectContent({ className = "", children }) {
  const { val, set } = useContext(Ctx) || {};
  // flatten <SelectItem>s from children
  const items = [];
  React.Children.forEach(children, (ch) => {
    if (React.isValidElement(ch) && ch.type === SelectItem) {
      items.push({ value: ch.props.value, label: ch.props.children });
    }
  });
  return (
    <select
      className={`h-9 px-3 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
      value={val || ""}
      onChange={(e) => set(e.target.value)}
    >
      {items.map((it) => (
        <option key={it.value} value={it.value}>
          {it.label}
        </option>
      ))}
    </select>
  );
}

export function SelectItem({ value, children }) {
  // only used as a marker; real <option> rendered in SelectContent
  return <option value={value}>{children}</option>;
}

// default export for "import Select from ...", also supports named imports
export default Select;
