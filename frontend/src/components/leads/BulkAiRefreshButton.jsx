// src/components/leads/BulkAiRefreshButton.jsx
import React, { useMemo, useRef, useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function BulkAiRefreshButton({
  selectedIds = [],
  className = "",
  concurrency = 3,
  onEach,      // (id, {ok: boolean, error?: string}) => void
  onFinished,  // (summary) => void
}) {
  const { aiRefresh } = useLeadsApi();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [ok, setOk] = useState(0);
  const [fail, setFail] = useState(0);
  const [log, setLog] = useState([]);
  const cancelledRef = useRef(false);

  const ids = useMemo(
    () => (Array.isArray(selectedIds) ? [...new Set(selectedIds)] : []),
    [selectedIds]
  );
  const total = ids.length;

  const start = async () => {
    if (!ids.length || running) return;
    cancelledRef.current = false;
    setRunning(true);
    setDone(0); setOk(0); setFail(0); setLog([]);

    try {
      let cursor = 0;
      const workers = new Array(Math.min(concurrency, ids.length)).fill(0).map(async () => {
        while (cursor < ids.length && !cancelledRef.current) {
          const id = ids[cursor++];
          try {
            await aiRefresh(id);
            setOk((v) => v + 1);
            setLog((L) => [{ id, status: "ok", ts: Date.now() }, ...L].slice(0, 200));
            onEach?.(id, { ok: true });
          } catch (e) {
            const msg = String(e?.message || e);
            setFail((v) => v + 1);
            setLog((L) => [{ id, status: "fail", err: msg, ts: Date.now() }, ...L].slice(0, 200));
            onEach?.(id, { ok: false, error: msg });
          } finally {
            setDone((v) => v + 1);
          }
        }
      });

      await Promise.all(workers);
    } finally {
      setRunning(false);
      onFinished?.({ total, ok, fail, cancelled: cancelledRef.current });
    }
  };

  const cancel = () => { cancelledRef.current = true; };
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={className}>
      <button
        type="button"
        className="gg-btn gg-btn-primary"
        disabled={!ids.length}
        onClick={() => setOpen(true)}
        title="AI summarize & suggest for all selected leads"
      >
        Bulk AI re-enrich ({ids.length})
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000]">
          <div className="absolute inset-0 bg-black/40" onClick={() => !running && setOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gg-panel rounded-2xl w-[640px] max-w-[92vw] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Bulk AI re-enrich</h3>
              <button className="gg-btn gg-btn-ghost" onClick={() => !running && setOpen(false)}>✕</button>
            </div>

            <div className="space-y-3">
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                Selected leads: <b>{total}</b> · Concurrency: <b>{concurrency}</b>
              </div>

              <div className="w-full h-2 bg-[color:var(--border)] rounded-full overflow-hidden">
                <div className="h-2 bg-[var(--ring)]" style={{ width: `${pct}%`, transition: "width .2s ease" }} />
              </div>

              <div className="text-sm">
                Done <b>{done}</b> / {total} · ✅ <b>{ok}</b> · ❌ <b>{fail}</b>
              </div>

              <div className="gg-card max-h-56 overflow-auto text-xs">
                {log.length === 0 ? (
                  <div className="text-[color:var(--muted)]">No logs yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {log.map((r, i) => (
                      <li key={`${r.id}-${i}`}>
                        <code>{r.id}</code> — {r.status === "ok" ? "✅ ok" : `❌ ${r.err || "failed"}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-2">
                {!running ? (
                  <>
                    <button className="gg-btn gg-btn-ghost" onClick={() => setOpen(false)}>Close</button>
                    <button className="gg-btn gg-btn-primary" disabled={!ids.length} onClick={start}>
                      Run now
                    </button>
                  </>
                ) : (
                  <>
                    <button className="gg-btn gg-btn-ghost" onClick={cancel}>Cancel</button>
                    <button className="gg-btn" disabled>Running…</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
