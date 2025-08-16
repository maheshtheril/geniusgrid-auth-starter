import React from "react";

export default function Badge({ children, variant = "default", className = "" }) {
  const variants = {
    default: "bg-primary/10 text-primary border border-primary/20",
    secondary: "bg-muted text-foreground border border-border",
    success: "bg-green-100 text-green-700 border border-green-300",
    danger: "bg-red-100 text-red-700 border border-red-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
