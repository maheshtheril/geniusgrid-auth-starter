import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export const Input = React.forwardRef(function Input(
  { className="", type="text", ...props }, ref
){
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        "gg-input w-full h-9 px-3 rounded-lg border border-border bg-background",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        "placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});
  