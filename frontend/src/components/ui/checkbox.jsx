import React, { useState } from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export const Checkbox = React.forwardRef(function Checkbox(
  { checked: c, onCheckedChange, className="", ...props }, ref
){
  const [u, setU] = useState(!!c);
  const checked = c ?? u;
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => { const v = !checked; if (c === undefined) setU(v); onCheckedChange?.(v); }}
      className={cx(
        "inline-flex items-center justify-center w-5 h-5 rounded border border-border",
        checked ? "bg-primary text-primary-foreground" : "bg-background",
        className
      )}
      {...props}
    >
      {checked ? "✓" : ""}
    </button>
  );
});
