// src/pages/leads/DiscoverLeads.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js"; // shared API (baseURL + credentials)

export default function DiscoverLeads() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(50);
  const [job, setJob] = useState(null);
  const [events, setEvents] = useState([]);
  const [preview, setPreview] = useState([]); // inline preview of discovered items
  const sinceRef = useRef(null);
  const pollTimer = useRef(null);

  async function start() {
    if (!prompt.trim()) return; // guard

    const { data } = await api.post("/ai/prospect/jobs", {
      prompt,
      size,
      providers: ["pdl"],
      filters: {},
    });

    const j = data?.data || data;
    setJob(j);
    setEvents([]);
    setPreview([]);
    sinceRef.current = null;

    clearTimeout(pollTimer.current);
    tick(j.id);
  }

  async function tick(jobId) {
    if (!jobId) return;

    try {
      // 1) fetch job status
      const st = await api.get(`/ai/prospect/jobs/${jobId}`);
      const jd = st?.data?.data || st?.data || {};
      setJob(jd);

      // 2) fetch events (delta by ts)
      const qs = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : "";
      const ev = await api.get(`/ai/prospect/jobs/${jobId}/events${qs}`);
      const evd = ev?.data?.data || ev?.data || [];
      if (Array.isArray(evd) && evd.length) {
        setEvents((prev) => [...prev, ...evd]);
        sinceRef.current = evd[evd.length - 1].ts;
      }

      // 3) when import is ready, show a small inline preview
      if (jd.import_job_id) {
        try {
          const pv = await api.get(`/leads/imports/${jd.import_job_id}/items?limit=5`);
          setPreview(pv?.data?.data || pv?.data || []);
        } catch {
          // ignore preview errors; user can still click through to full review
        }
      }

      // 4) continue while queued/running
      if (jd?.status === "queued" || jd?.status === "running") {
        pollTimer.current = setTimeout(() => tick(jobId), 1500);
      }
    } catch {
      // transient errors: back off and retry
      pollTimer.current = setTimeout(() => tick(jobId), 2000);
    }
  }

  useEffect(() => () => clearTimeout(pollTimer.current), []);

  const goReview = () =>
    job?.import_job_id && (window.location.href = `/leads/imports/${job.import_job_id}`);

  return (
    <div className="space-y-3">
      {/* Input panel */}
      <div className="gg-panel p-3">
        <div className="form-col">
          <label className="form-label">Ideal Customer Profile (Prompt)</label>
          <textarea
            className="gg-textarea"
            rows={5}
            placeholder="e.g., Mid-market manufacturers in India evaluating ERP. Titles: procurement, finance, operations."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 mt-3">
          <input
            className="gg-input"
            type="number"
            min="5"
            max="200"
            value={size}
            onChange={(e) => setSize(+e.target.value || 50)}
            style={{ width: 96 }}
          />
          <button
            className="gg-btn gg-btn-primary"
            disabled={!prompt.trim()}
            onClick={start}
          >
            ✨ Find Leads
          </button>
        </div>
      </div>

      {/* Job + events + preview */}
      {job && (
        <div className="gg-surface p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="gg-muted text-sm">Job</div>
              <div>
                <code>{job.id}</code> — <b>{job.status}</b>
              </div>
            </div>
            <div className="flex gap-2">
              {job.import_job_id && (
                <>
                  <button className="gg-btn" onClick={goReview}>
                    Review Import
                  </button>
                  <Link className="gg-btn" to={`/leads/imports/${job.import_job_id}`}>
                    Open full review →
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {/* Events stream */}
            <div>
              <div className="gg-muted text-sm mb-1">Events</div>
              <div className="mt-1" style={{ maxHeight: 300, overflow: "auto" }}>
                {events.length ? (
                  events.map((e) => (
                    <div key={e.id} className="text-sm">
                      <span className="gg-muted">
                        {new Date(e.ts).toLocaleTimeString()} • {e.level}
                      </span>{" "}
                      — {e.message}
                    </div>
                  ))
                ) : (
                  <div className="gg-muted text-sm">No events yet…</div>
                )}
              </div>
            </div>

            {/* Inline preview (first few items) */}
            {!!preview.length && (
              <div>
                <div className="gg-muted text-sm mb-1">
                  Preview (first {preview.length})
                </div>
                <div className="gg-table">
                  <div className="gg-thead">
                    <div className="gg-tr">
                      <div className="gg-th">Name</div>
                      <div className="gg-th">Title</div>
                      <div className="gg-th">Company</div>
                      <div className="gg-th">Email</div>
                    </div>
                  </div>
                  <div>
                    {preview.map((i) => (
                      <div className="gg-tr" key={i.id}>
                        <div className="gg-td">{i.name || i.full_name || "-"}</div>
                        <div className="gg-td">{i.title || "-"}</div>
                        <div className="gg-td">{i.company || i.org || "-"}</div>
                        <div className="gg-td">{i.email || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-2">
                  <Link className="gg-btn" to={`/leads/imports/${job.import_job_id}`}>
                    Open full review →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
