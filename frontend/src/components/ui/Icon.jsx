// -----------------------------------------------
// src/components/ui/Icon.jsx
// -----------------------------------------------
import * as Icons from "lucide-react";
export default function Icon({ name = "Dot", className = "w-4 h-4" }) {
  const Cmp = Icons[name] || Icons.Dot;
  return <Cmp className={className} aria-hidden />;
}

