import React from "react";

export default function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse bg-muted rounded-md ${className}`}
    />
  );
}
