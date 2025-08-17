import React from "react";
import * as Lucide from "lucide-react";

/**
 * <Icon name="Settings2" className="w-5 h-5" />
 * - name: any exported lucide-react icon name (e.g., Settings2, User, Search)
 * - If not found, renders a simple square placeholder.
 */
export function Icon({ name, className = "", ...props }) {
  const Cmp = (name && Lucide[name]) || null;
  if (Cmp) return <Cmp className={className} {...props} />;
  return (
    <span
      aria-hidden
      className={`inline-block align-middle rounded bg-muted ${className || "w-4 h-4"}`}
      {...props}
    />
  );
}

export default Icon;
