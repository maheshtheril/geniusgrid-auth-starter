// src/components/leads/LeadDrawer.jsx — world‑class responsive drawer
// Enhancements:
// - Sticky header + sticky save bar so actions never disappear
// - Fully responsive layout (mobile-first)
// - Global shortcuts: ⌘/Ctrl+S to Save, Esc to Close
// - Compact mode toggle (reduces paddings/heights) — persists in state
// - Deterministic save flow: edits accumulate, single Save commits via PATCH
// - Preserves your existing APIs (getLead, updateLead, listNotes, listHistory, aiRefresh, aiScore)

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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

  // sticky save state
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [changes, setChanges] = useState({});

  // compact density toggle
  const [dense, setDense] = useState(false);

  const allowedPatchKeys = useMemo(() => new Set(["status", "stage", "ai_summary", "ai_next", "ai_score"]), []);

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

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

      const notesArr = n.status === "fulfilled" ? ((Array.isArray(n.value?.items) ? n.value.items : n.value) || []) : [];
      const historyArr = h.status === "fulfilled" ? ((Array.isArray(h.value?.items) ? h.value.items : h.value) || []) : [];

      if (!mounted.current) return;
      setNotes(notesArr);
      setHistory(historyArr);
      setDirty(false);
      setChanges({});
    } catch (e) {
      if (!mounted.current) return;
      setError("Failed to load lead.");
    } finally {
      mounted.current && setLoading(false);
    }
  }, [api, id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Global shortcuts: ⌘/Ctrl+S to save, Esc to close
  useEffect(() => {
    const onKey = (e) => {
      const isModS = (e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey);
      if (isModS) {
        e.preventDefault();
        if (!saving && dirty) saveAll();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, dirty, onClose]);

  const markChange = useCallback((key, value) => {
    setLead((prev) => ({ ...(prev || {}), [key]: value }));
    if (allowedPatchKeys.has(key)) {
      setChanges((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    }
  }, [allowedPatchKeys]);

  const savePatch = async (patch) => {
    setError("");
    try {
      await api.updateLead(id, patch);
      setLead((prev) => ({ ...(prev || {}), ...patch }));
      onUpdated?.(patch);
    } catch (e) {
      setError(e?.response?.data?.error || "Update failed. Please try again.");
      throw e;
    }
  };

  const saveAll = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      if (Object.keys(changes).length > 0) {
        await savePatch(changes);
      }
      setDirty(false);
      setChanges({});
    } finally {
      setSaving(false);
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
      const res = await api.aiRefresh(id); // backend writes ai_summary + ai_next
      const next = {
        ai_summary: res?.summary ?? lead?.ai_summary ?? null,
        ai_next: Array.isArray(res?.next_actions) ? res.next_actions : (Array.isArray(lead?.ai_next) ? lead.ai_next : []),
      };
      setLead((l) => (l ? { ...l, ...next } : l));
      setChanges((c) => ({ ...c, ...next }));
      setDirty(true);
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
      const res = api.aiScore ? await api.aiScore(id) : await post(`/leads/${id}/ai-score`, {});
      const score = Number(res?.score ?? res?.data?.score ?? 0);
      markChange("ai_score", score);
    } catch {
      setError("AI score failed.");
    } finally {
      setScoreBusy(false);
    }
  };

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex bg-base-200/50 backdrop-blur">
      {/* Backdrop click to close (mobile-friendly) */}
      <div className="flex-1" onClick={onClose} aria-hidden />

      <div className="ml-auto h-full w-full max-w-[920px] bg-base-100 shadow-2xl grid grid-rows-[auto_auto_1fr_auto]" data-dense={dense}>
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 bg-base-100/95 backdrop-blur border-b">
          <div className="p-3 md:p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{lead?.name || "Lead"}</div>
              <div className="opacity-60 text-xs md:text-sm truncate">
                {lead?.company_name || lead?.company?.name || "—"}
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button className="btn btn-sm" disabled={aiBusy} onClick={refreshAI} title="Generate summary & next actions">
                {aiBusy ? "Refreshing…" : "↻ AI"}
              </button>
              <button className="btn btn-sm" disabled={scoreBusy} onClick={runScore} title="Re-score this lead">
                {scoreBusy ? "Scoring…" : "★ Score"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
          {/* Tabs bar */}
          <div className="px-3 md:px-4 pb-2 flex items-center gap-2">
            <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>Summary</TabButton>
            <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>Notes</TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>History</TabButton>
            <button className="btn btn-ghost btn-xs md:btn-sm ml-auto" onClick={() => setDense((d) => !d)} title="Toggle compact mode (reduces paddings)">
              {dense ? 'Comfort' : 'Compact'}
            </button>
            <div className="sm:hidden flex items-center gap-2">
              <button className="btn btn-xs" disabled={aiBusy} onClick={refreshAI}>{aiBusy ? "Refreshing…" : "↻ AI"}</button>
              <button className="btn btn-xs" disabled={scoreBusy} onClick={runScore}>{scoreBusy ? "Scoring…" : "★ Score"}</button>
            </div>
          </div>
        </header>

        {/* Error banner (sticky under header if present) */}
        {error ? (
          <div className="z-10 bg-error/10 text-error text-sm px-3 py-2 border-b border-error/20">{error}</div>
        ) : (
          <div className="h-0" />
        )}

        {/* Scrollable Content */}
        <main className="overflow-y-auto p-3 md:p-4 space-y-4">
          {loading ? (
            <Skeleton />
          ) : tab === "summary" ? (
            <SummaryTab lead={lead} markChange={markChange} />
          ) : tab === "notes" ? (
            <NotesTab notes={notes} noteText={noteText} setNoteText={setNoteText} addNote={addNote} />
          ) : (
            <HistoryTab history={history} />
          )}
        </main>

        {/* Sticky Save Bar */}
        <footer className="sticky bottom-0 z-20 bg-base-100/95 backdrop-blur border-t">
          <div className="px-3 md:px-4 py-2 flex items-center gap-2">
            <div className="text-xs opacity-70">
              {dirty ? (
                <>
                  You have unsaved changes — <kbd className="kbd kbd-xs">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd className="kbd kbd-xs">S</kbd> to save
                </>
              ) : (
                "All changes saved"
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              <button className={`btn btn-primary btn-sm ${saving || !dirty ? "btn-disabled" : ""}`} disabled={saving || !dirty} onClick={saveAll}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Compact style overrides */}
      <style>{`
        [data-dense='true'] .p-3{padding:0.5rem!important}
        [data-dense='true'] .p-4{padding:0.75rem!important}
        [data-dense='true'] .md\\:p-4{padding:0.75rem!important}
        [data-dense='true'] .btn{height:2rem;min-height:2rem}
        [data-dense='true'] .btn-sm{height:1.75rem;min-height:1.75rem}
        [data-dense='true'] .input,[data-dense='true'] .select,[data-dense='true'] .textarea{font-size:0.95rem}
        [data-dense='true'] header{padding-bottom:0!important}
      `}</style>
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function TabButton({ active, onClick, children }) {
  return (
    <button className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-24 bg-base-200 rounded" />
      ))}
    </div>
  );
}

function SummaryTab({ lead, markChange }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* AI Summary */}
      <div className="md:col-span-2">
        <label className="block text-xs md:text-sm opacity-70 mb-1">AI Summary</label>
        <textarea
          className="textarea w-full h-28"
          value={lead?.ai_summary || ""}
          onChange={(e) => markChange("ai_summary", e.target.value)}
          placeholder="Run AI Refresh or write a quick synopsis…"
        />
      </div>

      {/* Next Actions */}
      <div className="md:col-span-2">
        <label className="block text-xs md:text-sm opacity-70 mb-1">AI Next Actions</label>
        <textarea
          className="textarea w-full h-28"
          placeholder="One action per line"
          value={Array.isArray(lead?.ai_next) ? lead.ai_next.join("\n") : ""}
          onChange={(e) => markChange("ai_next", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        />
        {Array.isArray(lead?.ai_next) && lead.ai_next.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-sm opacity-80">
            {lead.ai_next.map((a, i) => (
              <li key={i}>{String(a)}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Status</label>
        <select className="select w-full" value={lead?.status || ""} onChange={(e) => markChange("status", e.target.value)}>
          <option value="new">new</option>
          <option value="qualified">qualified</option>
          <option value="won">won</option>
          <option value="lost">lost</option>
        </select>
      </div>

      {/* Stage */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Stage</label>
        <input className="input w-full" value={lead?.stage || ""} onChange={(e) => markChange("stage", e.target.value)} placeholder="e.g., new, prospect, proposal…" />
      </div>

      {/* AI Score */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">AI Score</label>
        <input type="number" className="input w-full" value={lead?.ai_score ?? ""} onChange={(e) => markChange("ai_score", Number(e.target.value || 0))} placeholder="0–100" />
        <div className="mt-2">
          <ScoreBar value={Number(lead?.ai_score ?? 0)} />
        </div>
      </div>

      {/* Contact (kept local — patch only if your backend allows email/phone) */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Email</label>
        <input className="input w-full" value={lead?.email || ""} onChange={(e) => { /* local only */ }} placeholder="you@company.com" />
      </div>
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Phone</label>
        <input className="input w-full" value={lead?.phone || ""} onChange={(e) => { /* local only */ }} placeholder="+91 98765 43210" />
      </div>
    </div>
  );
}

function NotesTab({ notes, noteText, setNoteText, addNote }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Write a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        <button className="btn btn-primary" onClick={addNote}>Add</button>
      </div>
      <div className="divide-y">
        {notes?.map((n) => (
          <div key={n.id} className="py-2">
            <div className="text-sm">{n.text || n.note || "—"}</div>
            <div className="opacity-60 text-xs">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</div>
          </div>
        ))}
        {(!notes || notes.length === 0) && <div className="opacity-60">No notes yet.</div>}
      </div>
    </div>
  );
}

function HistoryTab({ history }) {
  return (
    <div className="space-y-2">
      {history?.map((h) => (
        <div key={h.id} className="py-2">
          <div className="text-sm">
            {h.action || h.event_type || "event"} <span className="opacity-70">{h.table_name || ""}</span>
          </div>
          <div className="opacity-60 text-xs">{h.created_at ? new Date(h.created_at).toLocaleString() : ""}</div>
        </div>
      ))}
      {(!history || history.length === 0) && <div className="opacity-60">No history yet.</div>}
    </div>
  );
}

/* -------- UI bits -------- */
function ScoreBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-base-200">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: "linear-gradient(90deg, #22c55e 0%, #60a5fa 50%, #a855f7 100%)" }} />
      </div>
      <div className="mt-1 text-xs opacity-70">{v}%</div>
    </div>
  );
}
