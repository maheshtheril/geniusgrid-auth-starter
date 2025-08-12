// src/components/leads/RunAiNowButton.jsx
import React, { useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function RunAiNowButton({ leadId, onDone, className = "" }) {
  const { aiRefresh } = useLeadsApi();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");

  const runNow = async () => {
    if (!leadId || running) return;
    setRunning(true);
    setMsg("");
    try {
      const res = await aiRefresh(leadId);
      setMsg("AI updated");
      // optional: parent can re-fetch the lead
      onDone?.(res);
      // tiny success pulse
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      console.error(e);
      setMsg("AI failed");
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={runNow}
        disabled={running || !leadId}
        className="gg-btn gg-btn-primary"
        aria-busy={running}
        title="Generate summary & next actions"
      >
        {running ? "Running AI…" : "Run AI now"}
      </button>
      {msg && (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {msg}
        </span>
      )}
    </div>
  );
}
