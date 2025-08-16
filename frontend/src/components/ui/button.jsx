import React from "react";
export function Button({ as:Tag="button", variant="default", size="md", className="", ...p }){
  const base="inline-flex items-center justify-center rounded-lg border transition";
  const variants={
    default:"bg-primary text-primary-foreground border-transparent hover:opacity-90",
    secondary:"bg-muted text-foreground hover:bg-muted/80",
    outline:"bg-transparent border border-border hover:bg-muted/40",
    ghost:"bg-transparent hover:bg-muted/40"
  };
  const sizes={ sm:"h-8 px-3 text-sm", md:"h-9 px-4", lg:"h-10 px-5 text-base" };
  return <Tag className={`${base} ${variants[variant]||variants.default} ${sizes[size]||sizes.md} ${className}`} {...p} />;
}
export default Button;
