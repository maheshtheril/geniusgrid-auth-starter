import React from "react";
export function Input({ className = "", ...props }) {
  return (
    <input
      className={`h-9 px-3 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${className}`}
      {...props}
    />
  );
}
export default Input;
