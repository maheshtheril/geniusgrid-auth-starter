// src/layouts/ProtectedLayout.jsx
import { useEffect } from "react";
import { useEnv } from "../store/useEnv";

export default function ProtectedLayout({ children }) {
  const { ready, bootstrap } = useEnv();

  useEffect(() => { bootstrap().catch(console.error); }, [bootstrap]);
  if (!ready) return <div className="p-8">Loading workspace…</div>;
  return children;
}