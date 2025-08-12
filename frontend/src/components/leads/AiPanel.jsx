import React, { useEffect, useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function AiPanel({ leadId }) {
  const api = useLeadsApi();
  const [ai, setAi] = useState({ items: [] });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try { setAi(await api.getAI(leadId)); } finally { setLoading(false); }
  }
  useEffect(() => { if (leadId) load(); }, [leadId]);

  return (
    <div className="gg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold">AI Insights</div>
        <div className="flex gap-2">
          <button className="gg-btn gg-btn-ghost" disabled={loading} onClick={load}>Refresh</button>
          <button
            className="gg-btn"
            disabled={loading}
            onClick={async ()=>{
              await api.aiRefresh(leadId);
              await load();
            }}
          >Re-summarize</button>
          <button
            className="gg-btn gg-btn-primary"
            disabled={loading}
            onClick={async ()=>{
              await api.aiScore(leadId);
              await load();
            }}
          >Re-score</button>
        </div>
      </div>

      {loading && <div className="text-sm" style={{color:"var(--muted)"}}>Loading…</div>}

      {(ai?.data || []).slice(0, 1).map((row, i) => {
        const d = row.data || {};
        return (
          <div key={i} className="space-y-2">
            {d.summary && (
              <>
                <div className="text-xs font-semibold">Summary</div>
                <div className="text-sm whitespace-pre-wrap">{d.summary}</div>
              </>
            )}
            {Array.isArray(d.next_actions) && d.next_actions.length > 0 && (
              <>
                <div className="text-xs font-semibold mt-2">Next actions</div>
                <ul className="list-disc pl-5 text-sm">
                  {d.next_actions.map((a, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{a.action}</span>
                      {a.why ? <span className="ml-1 gg-muted">— {a.why}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
