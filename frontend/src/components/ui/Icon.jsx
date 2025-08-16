import React from "react";

export default function Icon({ name, className = "", ...props }) {
  // simple fallback icon
  return (
    <span
      className={`inline-block w-5 h-5 bg-muted text-xs grid place-items-center rounded ${className}`}
      {...props}
    >
      {name?.[0] || "?"}
    </span>
  );
}
