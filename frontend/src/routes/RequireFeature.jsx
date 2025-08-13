// src/routes/RequireFeature.jsx
import { Navigate } from "react-router-dom";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";

export default function RequireFeature({ feature, children, fallback = "/app/leads" }) {
  const { ready, ent } = useEntitlements();
  if (!ready) return null; // or a spinner
  const has = !!(ent?.features && ent.features[feature]);
  return has ? children : <Navigate to={fallback} replace />;
}
