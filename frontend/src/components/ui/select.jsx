import React, { createContext, useContext, useMemo, useState } from "react";

const Ctx = createContext({ val:"", set: () => {} });

export function Select({ value, defaultValue="", onValueChange, children }){
  const [val, setVal] = useState(value ?? defaultValue);
  const set = (v) => { setVal(v); onValueChange?.(v); };
  const api = useMemo(() => ({ val, set }), [val]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function SelectTrigger({ className="", children, ...p }){
  return <div className={`relative ${className}`} {...p}>{children}</div>;
}

export function SelectValue({ placeholder }){
  const { val } = useContext(Ctx) || {};
  return <span>{val || placeholder || ""}</span>;
}

export function SelectContent({ className="", children }){
  const { val, set } = useContext(Ctx) || {};
  const items = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <select
      className={`h-9 px-3 rounded-lg border bg-background ${className}`}
      value={val || ""}
      onChange={(e)=>set(e.target.value)}
    >
      {items.map((el, i) =>
        el.type === SelectItem ? (
          <option key={i} value={el.props.value}>{el.props.children}</option>
        ) : null
      )}
    </select>
  );
}

export function SelectItem({ value, children }){
  return <option value={value}>{children}</option>;
}

export default Select;
