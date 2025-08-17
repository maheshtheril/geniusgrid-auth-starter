import React, { useState } from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export const Switch = React.forwardRef(function Switch(
  { checked:c, onCheckedChange, className="", ...props }, ref
){
  const [u, setU] = useState(!!c);
  const checked = c ?? u;
  return (
    <button
      ref={ref}
      role="switch"
      aria-checked={checked}
      onClick={() => { const v = !checked; if (c === undefined) setU(v); onCheckedChange?.(v); }}
      className={cx(
        "inline-flex h-6 w-10 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
      {...props}
    >
      <span
        className={cx(
          "h-5 w-5 bg-background rounded-full shadow transform transition-transform mx-0.5",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
});
