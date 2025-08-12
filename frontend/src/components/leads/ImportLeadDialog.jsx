// src/components/leads/ImportLeadDialog.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLeadsImportApi from "@/hooks/useLeadsImportApi";

export default function ImportLeadDialog({ onClose }) {
  const { createImport, getJob, getRows } = useLeadsImportApi();
  const [file, setFile] = useState(null);
  const [opt, setOpt] = useState({ aiEnrich: false, defaultStage: "new", defaultSource: "" });
  const [job, setJob] = useState(null);
  const [rows, setRows] = useState([]);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!job || polling) return;
    if (job.status === "completed" || job.status === "failed") return;

    setPolling(true);
    const t = setInterval(async () => {
      try {
        const j = await getJob(job.id);
        setJob(j);
        if (j.status === "completed" || j.status === "failed") {
          clearInterval(t);
          setPolling(false);
          const bad = await getRows(j.id, { outcome: "failed", limit: 50, offset: 0 });
          setRows(bad);
        }
      } catch {
        clearInterval(t);
        setPolling(false);
      }
    }, 1200);

    return () => clearInterval(t);
  }, [job, polling, getJob, getRows]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please choose a CSV file.");
      return;
    }
    try {
      const created = await createImport(file, opt);
      setJob(created);
    } catch (err) {
      setError(err?.message || "Upload failed");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 gg-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Import Leads (CSV)</h3>
          <button className="gg-btn gg-btn-ghost" onClick={onClose}>✕</button>
        </div>

        {!job && (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="gg-label">CSV file</label>
              <input type="file" accept=".csv,text/csv" className="gg-input w-full"
                     onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="gg-label">Default Stage</label>
                <select className="gg-input w-full" value={opt.defaultStage}
                        onChange={(e)=>setOpt(s=>({...s, defaultStage:e.target.value}))}>
                  {["new","prospect","proposal","negotiation","closed"].map(s=>
                    <option key={s} value={s}>{s}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="gg-label">Default Source</label>
                <input className="gg-input w-full" placeholder="e.g., Import"
                       value={opt.defaultSource}
                       onChange={(e)=>setOpt(s=>({...s, defaultSource:e.target.value}))}/>
              </div>
            </div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={opt.aiEnrich}
                     onChange={(e)=>setOpt(s=>({...s, aiEnrich:e.target.checked}))}/>
              <span className="text-sm">Auto-enrich with AI after import</span>
            </label>

            {error && <div className="text-rose-400 text-sm">{error}</div>}

            <div className="flex justify-end gap-2">
              <button type="button" className="gg-btn gg-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="gg-btn gg-btn-primary">Start Import</button>
            </div>
          </form>
        )}

        {job && (
          <div className="space-y-3">
            <div className="gg-card p-3">
              <div className="text-sm">Job ID: <code className="text-xs">{job.id}</code></div>
              <div className="text-sm">Status: <b className="capitalize">{job.status}</b></div>
              <div className="grid grid-cols-4 gap-2 text-sm mt-2">
                <div>Total: {job.total_rows ?? 0}</div>
                <div>Inserted: {job.inserted_count ?? 0}</div>
                <div>Duplicates: {job.duplicate_count ?? 0}</div>
                <div>Failed: {job.failed_count ?? 0}</div>
              </div>
            </div>

            {(job.status === "completed" || job.status === "failed") && rows.length > 0 && (
              <div className="gg-card p-3">
                <div className="font-medium mb-2">Failed rows (first {rows.length})</div>
                <div className="max-h-64 overflow-auto text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="p-1">#</th>
                        <th className="p-1">Outcome</th>
                        <th className="p-1">Error</th>
                        <th className="p-1">Input</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r=>(
                        <tr key={r.id}>
                          <td className="p-1">{r.row_no}</td>
                          <td className="p-1">{r.outcome}</td>
                          <td className="p-1">{r.error_text}</td>
                          <td className="p-1">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(r.input_json, null, 0)}</pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </div>
            )}

            <div className="flex justify-end">
              <button className="gg-btn gg-btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
