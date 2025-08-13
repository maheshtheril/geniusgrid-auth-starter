import { useEffect, useRef, useState } from "react";

export default function DiscoverLeads() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(50);
  const [job, setJob] = useState(null);
  const [events, setEvents] = useState([]);
  const sinceRef = useRef(null);

  async function start() {
    const resp = await fetch(`${import.meta.env.VITE_API_BASE}/ai/prospect/jobs`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, size, providers: ["pdl"], filters: {} })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.message || "Failed");
    setJob(json.data);
    setEvents([]);
    sinceRef.current = null;
  }

  useEffect(() => {
    if (!job?.id) return;
    let stop = false;
    const tick = async () => {
      try {
        const st = await fetch(`${import.meta.env.VITE_API_BASE}/ai/prospect/jobs/${job.id}`, { credentials: "include" }).then(r=>r.json());
        setJob(st.data);
        const qs = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : "";
        const ev = await fetch(`${import.meta.env.VITE_API_BASE}/ai/prospect/jobs/${job.id}/events${qs}`, { credentials: "include" }).then(r=>r.json());
        if (ev?.data?.length) {
          setEvents((prev)=>[...prev, ...ev.data]);
          sinceRef.current = ev.data[ev.data.length-1].ts;
        }
        if (!stop && (st.data.status === "queued" || st.data.status === "running")) {
          setTimeout(tick, 1500);
        }
      } catch {}
    };
    tick();
    return ()=>{ stop=true; };
  }, [job?.id]);

  const goReview = () => job?.import_job_id && (window.location.href = `/leads/imports/${job.import_job_id}`);

  return (
    <div className="space-y-3">
      <div className="gg-panel p-3">
        <div className="form-col">
          <label className="form-label">Ideal Customer Profile (Prompt)</label>
          <textarea className="gg-textarea" rows={5}
            placeholder="e.g., Mid-market manufacturers in India evaluating ERP. Titles: procurement, finance, operations."
            value={prompt} onChange={e=>setPrompt(e.target.value)} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <input className="gg-input" type="number" min="5" max="200" value={size} onChange={e=>setSize(+e.target.value||50)} />
          <button className="gg-btn gg-btn-primary" disabled={!prompt.trim()} onClick={start}>Find Leads</button>
        </div>
      </div>

      {job && (
        <div className="gg-surface p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="gg-muted text-sm">Job</div>
              <div><code>{job.id}</code> — <b>{job.status}</b></div>
            </div>
            <div className="flex gap-2">
              {job.import_job_id && <button className="gg-btn" onClick={goReview}>Review Import</button>}
            </div>
          </div>
          <div className="mt-3">
            <div className="gg-muted text-sm">Events</div>
            <div className="mt-2" style={{maxHeight:300, overflow:"auto"}}>
              {events.map(e=>(
                <div key={e.id} className="text-sm">
                  <span className="gg-muted">{new Date(e.ts).toLocaleTimeString()} • {e.level}</span> — {e.message}
                </div>
              ))}
              {!events.length && <div className="gg-muted text-sm">No events yet…</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}