import React from "react";

/** Minimal shadcn-compatible Separator */
export function Separator({ orientation = "horizontal", className = "", ...props }) {
  const isVertical = orientation === "vertical";
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={[
        "bg-border",
        isVertical ? "w-px h-full mx-2" : "h-px w-full my-2",
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
