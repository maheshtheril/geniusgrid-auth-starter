import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

/** shadcn-compatible Skeleton */
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;
