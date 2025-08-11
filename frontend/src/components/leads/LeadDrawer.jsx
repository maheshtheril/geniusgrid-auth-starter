import { useEffect, useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function LeadDrawer({ id, onClose, onUpdated }) {
  const api = useLeadsApi();
  const [lead, setLead] = useState(null);
  const [tab, setTab] = useState("summary");
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getLead(id);
        if (ok) setLead(data);
        const [n, h] = await Promise.all([
          api.listNotes(id, { limit: 20 }),
          api.listHistory(id, { limit: 50 }),
        ]);
        if (ok) { setNotes(n.items || n); setHistory(h.items || h); }
      } finally { if (ok) setLoading(false); }
    })();
    return () => { ok = false; };
  }, [id]);

  const savePatch = async (patch) => {
    await api.updateLead(id, patch);
    setLead(prev => ({ ...prev, ...patch }));
    onUpdated?.(patch);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const added = await api.addNote(id, { text: noteText });
    setNotes(prev => [added, ...prev]);
    setNoteText("");
  };

  const refreshAI = async () => {
    setAiBusy(true);
    try {
      const res = await api.aiRefresh(id);
      if (res?.score != null) savePatch({ score: res.score });
      if (res?.insight_summary) savePatch({ insight_summary: res.insight_summary });
    } finally { setAiBusy(false); }
  };

  return (
    <div className="drawer fixed inset-0 bg-base-200/50 backdrop-blur flex">
      <div className="ml-auto w-full max-w-[720px] h-full bg-base-100 shadow-xl flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <div className="font-semibold">{lead?.name || "Lead"}</div>
            <div className="opacity-60 text-sm">{lead?.company_name || "—"}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="p-3 flex items-center gap-2 border-b">
          <button className={`btn btn-sm ${tab==='summary'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab("summary")}>Summary</button>
          <button className={`btn btn-sm ${tab==='notes'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab("notes")}>Notes</button>
          <button className={`btn btn-sm ${tab==='history'?'btn-primary':'btn-ghost'}`} onClick={()=>setTab("history")}>History</button>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-sm" disabled={aiBusy} onClick={refreshAI}>
              {aiBusy ? "Refreshing AI…" : "Refresh AI"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && <div className="opacity-60">Loading…</div>}

          {!loading && tab === "summary" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm opacity-70">Insight Summary</label>
                <textarea
                  className="textarea w-full"
                  value={lead?.insight_summary || ""}
                  onChange={e => setLead(l => ({ ...l, insight_summary: e.target.value }))}
                  onBlur={() => savePatch({ insight_summary: lead?.insight_summary || "" })}
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm opacity-70">Status</label>
                <select className="select w-full" value={lead?.status||""} onChange={e => savePatch({ status: e.target.value })}>
                  <option value="new">new</option>
                  <option value="qualified">qualified</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
                </select>
              </div>

              <div>
                <label className="block text-sm opacity-70">Stage</label>
                <input className="input w-full" value={lead?.stage||""}
                       onChange={e => setLead(l => ({ ...l, stage: e.target.value }))}
                       onBlur={() => savePatch({ stage: lead?.stage || "" })}/>
              </div>

              <div>
                <label className="block text-sm opacity-70">AI Score</label>
                <input className="input w-full" value={lead?.score ?? ""} onChange={e => setLead(l => ({ ...l, score: e.target.value }))} onBlur={() => savePatch({ score: Number(lead?.score)||0 })}/>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm opacity-70">Company</label>
                  <input className="input w-full" value={lead?.company_name||""}
                         onChange={e => setLead(l => ({ ...l, company_name: e.target.value }))}
                         onBlur={() => savePatch({ company_name: lead?.company_name||"" })}/>
                </div>
                <div>
                  <label className="block text-sm opacity-70">Owner</label>
                  <input className="input w-full" value={lead?.owner_name||""}
                         onChange={e => setLead(l => ({ ...l, owner_name: e.target.value }))}
                         onBlur={() => savePatch({ owner_name: lead?.owner_name||"" })}/>
                </div>
              </div>
            </div>
          )}

          {!loading && tab === "notes" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Write a note…" value={noteText} onChange={e=>setNoteText(e.target.value)} />
                <button className="btn btn-primary" onClick={addNote}>Add</button>
              </div>
              <div className="divide-y">
                {notes?.map(n => (
                  <div key={n.id} className="py-2">
                    <div className="text-sm">{n.text}</div>
                    <div className="opacity-60 text-xs">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                ))}
                {(!notes || notes.length===0) && <div className="opacity-60">No notes yet.</div>}
              </div>
            </div>
          )}

          {!loading && tab === "history" && (
            <div className="timeline">
              {history?.map(h => (
                <div key={h.id} className="py-2">
                  <div className="text-sm">{h.action} — <span className="opacity-70">{h.table_name}</span></div>
                  <div className="opacity-60 text-xs">{new Date(h.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(!history || history.length===0) && <div className="opacity-60">No history yet.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
