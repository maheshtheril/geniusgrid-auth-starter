import React from "react";
export function Button({ as:Tag="button", variant="default", size="md", className="", ...p }){
  const base = "inline-flex items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/60";
  const variants = {
    default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent hover:opacity-90 shadow",
    secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/80",
    outline: "bg-transparent border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50",
    ghost: "bg-transparent hover:bg-[hsl(var(--muted))]/40"
  };
  const sizes = { sm:"h-8 px-3 text-sm", md:"h-9 px-4", lg:"h-10 px-5 text-base" };
  return <Tag className={`${base} ${variants[variant]||variants.default} ${sizes[size]||sizes.md} ${className}`} {...p} />;
}
export default Button;
