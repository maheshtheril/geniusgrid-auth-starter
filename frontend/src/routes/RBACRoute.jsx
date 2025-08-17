import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/store/useAuth"; // your auth source

export default function RBACRoute({
  need = [],         // e.g., ["admin.access"]
  any = false,       // any vs all
  children,
}) {
  const { isAuthenticated, permissions } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const has = (p) => permissions?.includes(p);
  const allowed =
    need.length === 0 ? true : (any ? need.some(has) : need.every(has));

  if (!allowed) {
    if (import.meta.env.DEV) {
      // Dev-only visibility
      // eslint-disable-next-line no-console
      console.warn("RBAC denied:", { need, have: permissions });
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
