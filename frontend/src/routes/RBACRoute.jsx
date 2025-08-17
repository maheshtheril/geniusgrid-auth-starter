import React from "react";
import { Navigate } from "react-router-dom";
// If you store permissions elsewhere, adjust this hook/import:
import { useEnv } from "@/store/useEnv";

/**
 * RBACRoute
 * Usage: <RBACRoute need={["admin.access"]}><AdminModule/></RBACRoute>
 */
export default function RBACRoute({ need = [], children }) {
  const { userPermissions = [] } = useEnv?.() || {};
  const allowed = Array.isArray(need) && need.every(code => userPermissions.includes(code));
  return allowed ? children : <Navigate to="/dashboard" replace />;
}
