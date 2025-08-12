// src/components/leads/LeadDrawer.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";
import { post } from "@/lib/api";

export default function LeadDrawer({ id, onClose, onUpdated }) {
  const api = useLeadsApi();

  // core state
  const [lead, setLead] = useState(null);
  const [tab, setTab] = useState("summary");
  const [loading, setLoading] = useState(true);

  // activity streams
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [noteText, setNoteText] = useState("");

  // ai + errors
  const [aiBusy, setAiBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [error, setError] = useState("");

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getLead(id);
      if (!mounted.current) return;
      setLead(data);

      const [n, h] = await Promise.allSettled([
        api.listNotes?.(id, { limit: 20 }),
        api.listHistory?.(id, { limit: 50 }),
      ]);

      const notesArr =
        n.status === "fulfilled"
          ? (Array.isArray(n.value?.items) ? n.value.items : n.value) || []
          : [];
      const historyArr =
        h.status === "fulfilled"
          ? (Array.isArray(h.value?.items) ? h.value.items : h.value) || []
          : [];

      if (!mounted.current) return;
      setNotes(notesArr);
      setHistory(historyArr);
    } catch (e) {
      if (!mounted.current) return;
      setError("Failed to load lead.");
    } finally {
      mounted.current && setLoading(false);
    }
  }, [api, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const savePatch = async (patch) => {
    setError("");
    try {
      await api.updateLead(id, patch);
      setLead((prev) => ({ ...(prev || {}), ...patch }));
      onUpdated?.(patch);
    } catch (e) {
      setError("Update failed. Please try again.");
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const added = await api.addNote(id, { text: noteText.trim() });
      setNotes((prev) => [added, ...prev]);
      setNoteText("");
    } catch {
      setError("Could not add note.");
    }
  };

  // ---- AI actions ----
  const refreshAI = async () => {
    setAiBusy(true);
    setError("");
    try {
      const res = await api.aiRefresh(id); // backend writes ai_summary + ai_next on the lead and caches
      // try to optimistically apply if the route returns data
      const next = {
        ai_summary: res?.summary ?? lead?.ai_summary ?? null,
        ai_next: Array.isArray(res?.next_actions) ? res.next_actions : lead?.ai_next ?? [],
      };
      setLead((l) => (l ? { ...l, ...next } : l));
      // re-fetch to stay consistent with DB
      await fetchAll();
    } catch {
      setError("AI refresh failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const runScore = async () => {
    setScoreBusy(true);
    setError("");
    try {
      // prefer hook if you later add api.aiScore; fallback to direct call now
      const res = api.aiScore
        ? await api.aiScore(id)
        : await post(`/leads/${id}/ai-score`, {});
      const score = Number(res?.score ?? res?.data?.score ?? 0);
      setLead((l) => (l ? { ...l, ai_score: score } : l));
      onUpdated?.({ ai_score: score });
    } catch {
      setError("AI score failed.");
    } finally {
      setScoreBusy(false);
    }
  };

  if (!id) return null;

  return (
    <div className="drawer fixed inset-0 bg-base-200/50 backdrop-blur flex">
      <div className="ml-auto w-full max-w-[820px] h-full bg-base-100 shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">{lead?.name || "Lead"}</div>
            <div className="opacity-60 text-sm">
              {lead?.company_name || lead?.company?.name || "—"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-sm" disabled={aiBusy} onClick={refreshAI} title="Generate summary & next actions">
              {aiBusy ? "Refreshing AI…" : "↻ AI Refresh"}
            </button>
            <button className="btn btn-sm" disabled={scoreBusy} onClick={runScore} title="Re-score this lead">
              {scoreBusy ? "Scoring…" : "★ Score"}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="p-3 flex items-center gap-2 border-b">
          <button
            className={`btn btn-sm ${tab === "summary" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("summary")}
          >
            Summary
          </button>
          <button
            className={`btn btn-sm ${tab === "notes" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("notes")}
          >
            Notes
          </button>
          <button
            className={`btn btn-sm ${tab === "history" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
          <div className="ml-auto text-xs opacity-70">
            {lead?.created_at ? new Date(lead.created_at).toLocaleString() : ""}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="alert alert-error mb-3">
              <span>{error}</span>
            </div>
          )}

          {loading && <div className="opacity-60">Loading…</div>}

          {!loading && tab === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* AI Summary */}
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">AI Summary</label>
                <textarea
                  className="textarea w-full"
                  value={lead?.ai_summary || ""}
                  onChange={(e) =>
                    setLead((l) => ({ ...(l || {}), ai_summary: e.target.value }))
                  }
                  onBlur={() =>
                    savePatch({ ai_summary: lead?.ai_summary || "" })
                  }
                  rows={4}
                  placeholder="Run AI Refresh to generate a summary…"
                />
              </div>

              {/* Next Actions */}
              <div className="md:col-span-2">
                <label className="block text-sm opacity-70 mb-1">AI Next Actions</label>
                <textarea
                  className="textarea w-full"
                  rows={4}
                  placeholder="One action per line"
                  value={Array.isArray(lead?.ai_next) ? lead.ai_next.join("\n") : ""}
                  onChange={(e) => {
                    const lines = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                    setLead((l) => ({ ...(l || {}), ai_next: lines }));
                  }}
                  onBlur={() => savePatch({ ai_next: Array.isArray(lead?.ai_next) ? lead.ai_next : [] })}
                />
                {/* Read view */}
                {Array.isArray(lead?.ai_next) && lead.ai_next.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-sm opacity-80">
                    {lead.ai_next.map((a, i) => <li key={i}>{String(a)}</li>)}
                  </ul>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm opacity-70 mb-1">Status</label>
                <select
                  className="select w-full"
                  value={lead?.status || ""}
                  onChange={(e) => savePatch({ status: e.target.value })}
                >
                  <option value="new">new</option>
                  <option value="qualified">qualified</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
                </select>
              </div>

              {/* Stage */}
              <div>
                <label className="block text-sm opacity-70 mb-1">Stage</label>
                <input
                  className="input w-full"
                  value={lead?.stage || ""}
                  onChange={(e) => setLead((l) => ({ ...(l || {}), stage: e.target.value }))}
                  onBlur={() => savePatch({ stage: lead?.stage || "" })}
                  placeholder="e.g., new, prospect, proposal…"
                />
              </div>

              {/* AI Score */}
              <div>
                <label className="block text-sm opacity-70 mb-1">AI Score</label>
                <input
                  type="number"
                  className="input w-full"
                  value={lead?.ai_score ?? ""}
                  onChange={(e) =>
                    setLead((l) => ({ ...(l || {}), ai_score: e.target.value }))
                  }
                  onBlur={() =>
                    savePatch({ ai_score: Math.max(0, Math.min(100, Number(lead?.ai_score) || 0)) })
                  }
                  placeholder="0–100"
                />
                <div className="mt-2">
                  <ScoreBar value={Number(lead?.ai_score ?? 0)} />
                </div>
              </div>

              {/* Company / Owner */}
              <div>
                <label className="block text-sm opacity-70 mb-1">Company</label>
                <input
                  className="input w-full"
                  value={lead?.company_name || ""}
                  onChange={(e) =>
                    setLead((l) => ({ ...(l || {}), company_name: e.target.value }))
                  }
                  onBlur={() => savePatch({ company_name: lead?.company_name || "" })}
                />
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Owner</label>
                <input
                  className="input w-full"
                  value={lead?.owner_name || ""}
                  onChange={(e) =>
                    setLead((l) => ({ ...(l || {}), owner_name: e.target.value }))
                  }
                  onBlur={() => savePatch({ owner_name: lead?.owner_name || "" })}
                />
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm opacity-70 mb-1">Email</label>
                <input
                  className="input w-full"
                  value={lead?.email || ""}
                  onChange={(e) =>
                    setLead((l) => ({ ...(l || {}), email: e.target.value }))
                  }
                  onBlur={() => savePatch({ email: lead?.email || null })}
                />
              </div>
              <div>
                <label className="block text-sm opacity-70 mb-1">Phone</label>
                <input
                  className="input w-full"
                  value={lead?.phone || ""}
                  onChange={(e) =>
                    setLead((l) => ({ ...(l || {}), phone: e.target.value }))
                  }
                  onBlur={() => savePatch({ phone: lead?.phone || null })}
                />
              </div>
            </div>
          )}

          {!loading && tab === "notes" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Write a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <button className="btn btn-primary" onClick={addNote}>Add</button>
              </div>
              <div className="divide-y">
                {notes?.map((n) => (
                  <div key={n.id} className="py-2">
                    <div className="text-sm">{n.text || n.note || "—"}</div>
                    <div className="opacity-60 text-xs">
                      {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
                {(!notes || notes.length === 0) && (
                  <div className="opacity-60">No notes yet.</div>
                )}
              </div>
            </div>
          )}

          {!loading && tab === "history" && (
            <div className="timeline">
              {history?.map((h) => (
                <div key={h.id} className="py-2">
                  <div className="text-sm">
                    {h.action || h.event_type || "event"}{" "}
                    <span className="opacity-70">{h.table_name || ""}</span>
                  </div>
                  <div className="opacity-60 text-xs">
                    {h.created_at ? new Date(h.created_at).toLocaleString() : ""}
                  </div>
                </div>
              ))}
              {(!history || history.length === 0) && (
                <div className="opacity-60">No history yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------- UI bits -------- */

function ScoreBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            background:
              "linear-gradient(90deg, #22c55e 0%, #60a5fa 50%, #a855f7 100%)",
          }}
        />
      </div>
      <div className="mt-1 text-xs opacity-70">{v}%</div>
    </div>
  );
}
