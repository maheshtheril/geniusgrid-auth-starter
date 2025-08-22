// src/components/leads/LeadDrawer.jsx — master fields editable + shortcuts + compact mode
// - Sticky header + sticky save bar
// - ⌘/Ctrl+S Save, Esc Close
// - Compact mode toggle
// - MASTER FIELDS are now editable and saved via PATCH (server allow‑list updated)
// - UX tighten: Cmd/Ctrl+Enter to add note, disabled Add while saving, optimistic note insert + rollback, clearer errors
// - UX tighten: warn before unload/close if there are unsaved changes

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";
import { post } from "@/lib/api";

const DEFAULT_LEAD = {
  id: null,
  // master
  name: "", email: "", phone: "", website: "",
  source: "", followup_at: "",
  company_name: "", owner_name: "",
  priority: null, tags_text: "",
  // ai/pipeline
  status: "new", stage: "", ai_summary: "", ai_next: [], ai_score: 0,
  // optional/nested that API may send
  company: null,
};

function normalizeLead(raw = {}) {
  const base = { ...DEFAULT_LEAD, ...(raw || {}) };
  const unwrapped = base.item ?? base.data ?? base; // unwrap common API envelopes

  // flatten company name if nested
  const company_name =
    unwrapped.company_name ?? unwrapped.company?.name ?? DEFAULT_LEAD.company_name;

  // ensure array type for ai_next
  let ai_next = unwrapped.ai_next;
  if (typeof ai_next === "string") {
    // try JSON, else CSV/newlines → array
    if (ai_next.trim().startsWith("[")) {
      try { ai_next = JSON.parse(ai_next); } catch { ai_next = []; }
    } else {
      ai_next = ai_next
        .split(/\r?\n|,/) // split on newline or comma
        .map((s) => String(s).trim())
        .filter(Boolean);
    }
  } else if (!Array.isArray(ai_next)) {
    ai_next = [];
  }

  // numeric coercions
  const ai_score = Number.isFinite(Number(unwrapped.ai_score)) ? Number(unwrapped.ai_score) : 0;
  const priority = Number.isFinite(Number(unwrapped.priority)) ? Number(unwrapped.priority) : null;

  // date normalization to yyyy-mm-dd for input[type=date]
  let followup_at = unwrapped.followup_at || "";
  try {
    if (followup_at && !/^\d{4}-\d{2}-\d{2}$/.test(followup_at)) {
      const d = new Date(followup_at);
      if (!isNaN(d)) followup_at = d.toISOString().slice(0, 10);
    }
  } catch { /* noop */ }

  return {
    ...DEFAULT_LEAD,
    ...unwrapped,
    company_name,
    ai_next,
    ai_score,
    priority,
    followup_at,
  };
}

export default function LeadDrawer({ id, onClose, onUpdated }) {
  const api = useLeadsApi();

  const [lead, setLead] = useState(null);
  const [tab, setTab] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [changes, setChanges] = useState({});
  const [dense, setDense] = useState(false);

  // MASTER + AI fields allowed to PATCH
  const allowedPatchKeys = useMemo(
    () => new Set([
      // master
      "name", "email", "phone", "website", "source", "followup_at",
      "company_name", "owner_name", "priority", "tags_text",
      // ai / pipeline
      "status", "stage", "ai_summary", "ai_next", "ai_score",
    ]),
    []
  );

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const raw = await api.getLead(id);
      if (!mounted.current) return;
      const data = normalizeLead(raw);
      setLead(data);

      const [n, h] = await Promise.allSettled([
        api.listNotes?.(id, { limit: 20 }),
        api.listHistory?.(id, { limit: 50 }),
      ]);

      const notesArr = n.status === "fulfilled"
        ? ((Array.isArray(n.value?.items) ? n.value.items : n.value) || [])
        : [];

      const historyArr = h.status === "fulfilled"
        ? ((Array.isArray(h.value?.items) ? h.value.items : h.value) || [])
        : [];

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

  // Warn on unload if dirty
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const handleClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm("You have unsaved changes. Discard and close?");
      if (!ok) return;
    }
    onClose?.();
  }, [dirty, onClose]);

  // Global shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const isModS = (e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey);
      if (isModS) { e.preventDefault(); if (!saving && dirty) saveAll(); return; }
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, dirty, handleClose]);

  const markChange = useCallback((key, value) => {
    setLead((prev) => normalizeLead({ ...(prev || {}), [key]: value }));
    if (allowedPatchKeys.has(key)) {
      setChanges((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    }
  }, [allowedPatchKeys]);

  const savePatch = async (patch) => {
    setError("");
    try {
      const saved = await api.updateLead(id, patch);
      setLead((prev) => normalizeLead({ ...(prev || {}), ...saved, ...patch }));
      onUpdated?.(saved || patch);
    } catch (e) {
      setError(e?.response?.data?.error || "Update failed. Please try again.");
      throw e;
    }
  };

  const saveAll = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const payload = { ...changes };

      // date normalization (keep yyyy-mm-dd if provided)
      if (payload.followup_at && /^\d{4}-\d{2}-\d{2}$/.test(payload.followup_at)) {
        // ok
      } else if (payload.followup_at) {
        const d = new Date(payload.followup_at);
        if (!isNaN(d)) payload.followup_at = d.toISOString().slice(0, 10);
      }

      // ensure ai_next is array
      if (typeof payload.ai_next === "string") {
        payload.ai_next = payload.ai_next
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // coerce numbers
      if (payload.ai_score != null) payload.ai_score = Number(payload.ai_score) || 0;
      if (payload.priority != null) payload.priority = Number(payload.priority) || null;

      if (Object.keys(payload).length > 0) await savePatch(payload);
      setDirty(false);
      setChanges({});
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    const text = noteText.trim();
    if (!text || addingNote) return;
    setAddingNote(true);
    setError("");

    // optimistic insert
    const temp = { id: `temp-${Date.now()}`, text, created_at: new Date().toISOString() };
    setNotes((prev) => [temp, ...(prev || [])]);
    setNoteText("");

    try {
      const added = await api.addNote(id, { text });
      // replace temp with server version
      setNotes((prev) => prev.map((n) => (n.id === temp.id ? added : n)));
    } catch (e) {
      // rollback and show error
      setNotes((prev) => prev.filter((n) => n.id !== temp.id));
      const status = e?.response?.status;
      if (status === 404) setError("Notes API not found. Ensure /api/leads/:id/notes is mounted.");
      else setError(e?.response?.data?.error || "Could not add note.");
      setNoteText(text); // restore input
    } finally {
      setAddingNote(false);
    }
  };

  // AI actions
  const refreshAI = async () => {
    setAiBusy(true);
    setError("");
    try {
      const res = await api.aiRefresh(id);
      const next = {
        ai_summary: res?.summary ?? lead?.ai_summary ?? null,
        ai_next: Array.isArray(res?.next_actions)
          ? res.next_actions
          : (Array.isArray(lead?.ai_next) ? lead.ai_next : []),
      };
      setLead((l) => normalizeLead(l ? { ...l, ...next } : next));
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
      <div className="flex-1" onClick={handleClose} aria-hidden />

      <div className="ml-auto h-full w-full max-w-[920px] bg-base-100 shadow-2xl grid grid-rows-[auto_auto_1fr_auto]" data-dense={dense}>
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 bg-base-100/95 backdrop-blur border-b">
          <div className="p-3 md:p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{lead?.name || "Lead"}</div>
              <div className="opacity-60 text-xs md:text-sm truncate">{lead?.company_name || lead?.company?.name || "—"}</div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <button className="btn btn-sm" disabled={aiBusy} onClick={refreshAI} title="Generate summary & next actions">{aiBusy ? "Refreshing…" : "↻ AI"}</button>
              <button className="btn btn-sm" disabled={scoreBusy} onClick={runScore} title="Re-score this lead">{scoreBusy ? "Scoring…" : "★ Score"}</button>
              <button className="btn btn-ghost btn-sm" onClick={handleClose}>Close</button>
            </div>
          </div>
          <div className="px-3 md:px-4 pb-2 flex items-center gap-2">
            <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>Summary</TabButton>
            <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>Notes</TabButton>
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>History</TabButton>
            <button className="btn btn-ghost btn-xs md:btn-sm ml-auto" onClick={() => setDense((d) => !d)}>{dense ? 'Comfort' : 'Compact'}</button>
            <div className="sm:hidden flex items-center gap-2">
              <button className="btn btn-xs" disabled={aiBusy} onClick={refreshAI}>{aiBusy ? "Refreshing…" : "↻ AI"}</button>
              <button className="btn btn-xs" disabled={scoreBusy} onClick={runScore}>{scoreBusy ? "Scoring…" : "★ Score"}</button>
            </div>
          </div>
        </header>

        {error ? (<div className="z-10 bg-error/10 text-error text-sm px-3 py-2 border-b border-error/20">{error}</div>) : (<div className="h-0" />)}

        {/* Content */}
        <main className="overflow-y-auto p-3 md:p-4 space-y-4">
          {loading ? <Skeleton /> : tab === "summary" ? (
            <SummaryTab lead={lead} markChange={markChange} />
          ) : tab === "notes" ? (
            <NotesTab notes={notes} noteText={noteText} setNoteText={setNoteText} addNote={addNote} addingNote={addingNote} />
          ) : (
            <HistoryTab history={history} />
          )}
        </main>

        {/* Sticky Save Bar */}
        <footer className="sticky bottom-0 z-20 bg-base-100/95 backdrop-blur border-t">
          <div className="px-3 md:px-4 py-2 flex items-center gap-2">
            <div className="text-xs opacity-70">{dirty ? (<>
              You have unsaved changes — <kbd className="kbd kbd-xs">{typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd className="kbd kbd-xs">S</kbd> to save
            </>) : "All changes saved"}</div>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn btn-ghost btn-sm" onClick={handleClose}>Close</button>
              <button className={`btn btn-primary btn-sm ${saving || !dirty ? "btn-disabled" : ""}`} disabled={saving || !dirty} onClick={saveAll}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        </footer>
      </div>

      {/* Compact overrides */}
      <style>{`
        [data-dense='true'] .p-3{padding:0.5rem!important}
        [data-dense='true'] .p-4{padding:0.75rem!important}
        [data-dense='true'] .md\:p-4{padding:0.75rem!important}
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
  return (<button className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`} onClick={onClick}>{children}</button>);
}

function Skeleton() {
  return (
    <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(6)].map((_, i) => (<div key={i} className="h-24 bg-base-200 rounded" />))}
    </div>
  );
}

function SummaryTab({ lead, markChange }) {
  const dateVal = lead?.followup_at ? new Date(lead.followup_at).toISOString().slice(0,10) : "";
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Name */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Name</label>
        <input className="input w-full" value={lead?.name || ""} onChange={(e) => markChange("name", e.target.value)} placeholder="Lead name" />
      </div>
      {/* Company */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Company</label>
        <input className="input w-full" value={lead?.company_name || lead?.company?.name || ""} onChange={(e) => markChange("company_name", e.target.value)} />
      </div>
      {/* Owner */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Owner</label>
        <input className="input w-full" value={lead?.owner_name || ""} onChange={(e) => markChange("owner_name", e.target.value)} />
      </div>
      {/* Email */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Email</label>
        <input className="input w-full" value={lead?.email || ""} onChange={(e) => markChange("email", e.target.value)} placeholder="you@company.com" />
      </div>
      {/* Phone */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Phone</label>
        <input className="input w-full" value={lead?.phone || ""} onChange={(e) => markChange("phone", e.target.value)} placeholder="+91 98765 43210" />
      </div>
      {/* Website */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Website</label>
        <input className="input w-full" value={lead?.website || ""} onChange={(e) => markChange("website", e.target.value)} placeholder="https://…" />
      </div>
      {/* Source */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Source</label>
        <input className="input w-full" value={lead?.source || ""} onChange={(e) => markChange("source", e.target.value)} placeholder="Website / Referral / Ads / Event…" />
      </div>
      {/* Follow-up date */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Follow-up date</label>
        <input type="date" className="input w-full" value={dateVal} onChange={(e) => markChange("followup_at", e.target.value)} />
      </div>

      {/* AI Summary */}
      <div className="md:col-span-2">
        <label className="block text-xs md:text-sm opacity-70 mb-1">AI Summary</label>
        <textarea className="textarea w-full h-28" value={lead?.ai_summary || ""} onChange={(e) => markChange("ai_summary", e.target.value)} placeholder="Run AI Refresh or write a quick synopsis…" />
      </div>

      {/* Next Actions */}
      <div className="md:col-span-2">
        <label className="block text-xs md:text-sm opacity-70 mb-1">AI Next Actions</label>
        <textarea className="textarea w-full h-28" placeholder="One action per line" value={Array.isArray(lead?.ai_next) ? lead.ai_next.join("\n") : ""} onChange={(e) => markChange("ai_next", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
        {Array.isArray(lead?.ai_next) && lead.ai_next.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-sm opacity-80">{lead.ai_next.map((a, i) => (<li key={i}>{String(a)}</li>))}</ul>
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
        <div className="mt-2"><ScoreBar value={Number(lead?.ai_score ?? 0)} /></div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs md:text-sm opacity-70 mb-1">Priority</label>
        <input type="number" className="input w-full" value={lead?.priority ?? ""} onChange={(e) => markChange("priority", e.target.value)} placeholder="1 (high) – 3 (low)" />
      </div>

      {/* Tags */}
      <div className="md:col-span-2">
        <label className="block text-xs md:text-sm opacity-70 mb-1">Tags</label>
        <input className="input w-full" value={lead?.tags_text || ""} onChange={(e) => markChange("tags_text", e.target.value)} placeholder="comma/space separated" />
      </div>
    </div>
  );
}

function NotesTab({ notes, noteText, setNoteText, addNote, addingNote }) {
  const onKeyDown = (e) => {
    const isModEnter = (e.key === 'Enter') && (e.metaKey || e.ctrlKey);
    if (isModEnter) { e.preventDefault(); addNote(); }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Write a note…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="btn btn-primary" onClick={addNote} disabled={addingNote}>
          {addingNote ? 'Adding…' : 'Add'}
        </button>
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
          <div className="text-sm">{h.action || h.event_type || "event"} <span className="opacity-70">{h.table_name || ""}</span></div>
          <div className="opacity-60 text-xs">{h.created_at ? new Date(h.created_at).toLocaleString() : ""}</div>
        </div>
      ))}
      {(!history || history.length === 0) && <div className="opacity-60">No history yet.</div>}
    </div>
  );
}

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
