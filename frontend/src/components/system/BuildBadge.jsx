import { useEffect, useState } from "react";

export default function BuildBadge({ className = "" }) {
  const [sha, setSha] = useState("");

  useEffect(() => {
    let ok = true;
    fetch("/version.txt", { cache: "no-store" })
      .then(r => (r.ok ? r.text() : ""))
      .then(t => ok && setSha(t.trim().slice(0, 7)))
      .catch(() => {});
    return () => { ok = false; };
  }, []);

  if (!sha) return null;

  return (
    <span
      className={
        "text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 " +
        "font-mono tracking-tight " + className
      }
      title={`build ${sha}`}
    >
      build: {sha}
    </span>
  );
}
