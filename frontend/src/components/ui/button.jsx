import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export function Button({ asChild, variant="default", size="md", className="", ...props }) {
  const Tag = asChild ? "span" : "button";
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
    outline: "border border-border hover:bg-muted/40",
    ghost: "hover:bg-muted/40",
    link: "underline underline-offset-4 text-primary hover:opacity-80",
    destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  };
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-9 px-4 text-sm",
    lg: "h-10 px-5",
    icon: "h-9 w-9 p-0",
  };
  return (
    <Tag
      className={cx(
        "inline-flex items-center justify-center rounded-lg transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant] || variants.default,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    />
  );
}
