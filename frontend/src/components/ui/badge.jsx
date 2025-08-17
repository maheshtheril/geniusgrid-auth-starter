import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export function Badge({ variant="default", className="", ...props }) {
  const variants = {
    default: "bg-muted text-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-border",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 h-7 text-xs font-medium",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  );
}
