import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export const Textarea = React.forwardRef(function Textarea(
  { className = "", rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(
        "gg-input w-full min-h-[90px] px-3 py-2 rounded-lg border border-border bg-background",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        "placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});

export default Textarea;
