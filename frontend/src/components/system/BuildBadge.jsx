// src/components/system/BuildBadge.jsx
import React, { useEffect, useState } from "react";

export default function BuildBadge({ className = "" }) {
  const [sha, setSha] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/version.txt", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => {
        if (!alive) return;
        const s = String(t || "").trim().slice(0, 7);
        setSha(s);
      })
      .catch(() => {
        if (!alive) return;
        setSha(""); // silent fail
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!sha) return null;

  return (
    <span
      className={`px-2 py-1 text-[10px] rounded-md border border-[color:var(--border)] bg-[color:var(--panel)] tracking-wider ${className}`}
      title={`build ${sha}`}
    >
      #{sha}
    </span>
  );
}
