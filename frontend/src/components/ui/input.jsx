import React from "react";
export function Input({ className="", ...p }){
  return (
    <input
      className={`h-9 px-3 rounded-lg border bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]/50 ${className}`}
      {...p}
    />
  );
}
export default Input;
