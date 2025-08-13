// src/pages/leads/DiscoverLeads.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js"; // shared API (baseURL + credentials)

// 🚀 LIVE MODE: hit backend (PDL). Flip to true only if you want the old fake UI.
const USE_FRONTEND_MOCK = false;

/* ---------- helpers ---------- */

// Normalize various API array shapes to a plain array
function asArray(x) {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.events)) return x.events;
  return [];
}

/* Optional: tiny mock helpers for quick local demos (unused in live mode). */
function makeIndianPreview(size = 5) {
  const base = [
    { id: "IN-001", name: "Priya Sharma", title: "Procurement Manager", company: "Aarav Auto Components Pvt Ltd", email: "priya.sharma@aaravauto.in" },
    { id: "IN-002", name: "Rohan Iyer",   title: "Finance Controller",  company: "Kaveri Textiles Ltd",          email: "rohan.iyer@kaveritextiles.in" },
    { id: "IN-003", name: "Neha Gupta",   title: "Operations Head",      company: "Vistara Foods Pvt Ltd",        email: "neha.gupta@vistarafoods.in" },
    { id: "IN-004", name: "Arjun Mehta",  title: "Supply Chain Lead",    company: "Indus Machinery Works",        email: "arjun.mehta@indusmw.in" },
    { id: "IN-005", name: "Ananya Rao",   title: "Plant Admin",          company: "Sahyadri Ceramics",            email: "ananya.rao@sahyadri-ceramics.in" },
  ];
  const out = [];
  for (let i = 0; i < size; i++) {
    const t = base[i % base.length];
    out.push({ ...t, id: `${t.id}-${Math.floor(i / base.length) + 1}` });
  }
  return out.slice(0, size);
}
function makeMockEvents() {
  const now = Date.now();
  const mk = (ms, level, message) => ({ id: String(now + ms), ts: new Date(now + ms).toISOString(), level, message });
  return [
    mk(0, "info", "Queued: discovering Indian mid-market manufacturers"),
    mk(600, "info", "Running: searching procurement, finance & operations titles"),
    mk(1400, "info", "Enriching leads with email & company metadata"),
    mk(2200, "success", "Completed: mock data ready to review"),
  ];
}

/* ---------- component ---------- */

export default function DiscoverLeads() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(50);

  const [job, setJob] = useState(null);
  const [events, setEvents] = useState([]);
  const [preview, setPreview] = useState([]); // inline preview of discovered items

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sinceRef = useRef(null);
  const pollTimer = useRef(null);
  const cancelled = useRef(false);

  useEffect(() => () => clearTimeout(pollTimer.current), []);

  async function start() {
    if (!prompt.trim()) return;
    setError("");
    cancelled.current = false;

    // ---------------- FRONTEND MOCK ----------------
    if (USE_FRONTEND_MOCK) {
      clearTimeout(pollTimer.current);
      setEvents([]);
      setPreview([]);
      sinceRef.current = null;

      const mockJobId = "mock-job-IND-1";
      setJob({ id: mockJobId, status: "queued", import_job_id: "mock-import-IND-1" });

      const evs = makeMockEvents();
      evs.forEach((e, idx) => {
        setTimeout(() => {
          setEvents((prev) => [...prev, e]);
          setJob((j) => ({ ...(j || {}), status: idx < evs.length - 1 ? "running" : "completed" }));
        }, idx * 500);
      });

      setTimeout(() => {
        setPreview(makeIndianPreview(5));
        setJob({ id: mockJobId, status: "completed", import_job_id: "mock-import-IND-1" });
      }, 1700);
      return;
    }
    // ---------------- END FRONTEND MOCK ----------------

    // Live call to backend (uses your PDL_API_KEY server-side)
    try {
      setBusy(true);
      const { data } = await api.post("/ai/prospect/jobs", {
        prompt,
        size,
        providers: ["pdl"], // People Data Labs provider
        filters: {},        // add backend-supported filters here if needed
      });

      const j = data?.data || data;
      setJob(j);
      setEvents([]);
      setPreview([]);
      sinceRef.current = null;

      clearTimeout(pollTimer.current);
      tick(j.id);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Failed to start discovery";
      setError(msg);
      setBusy(false);
    }
  }

  async function tick(jobId) {
    if (!jobId || cancelled.current) return;

    try {
      // 1) fetch job status
      const st = await api.get(`/ai/prospect/jobs/${jobId}`);
      const jd = st?.data?.data || st?.data || {};
      setJob(jd);

      // 2) fetch events (delta by ts), with backfill if since-filter returns empty
      let evd = [];
      const qs = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : "";
      try {
        const ev = await api.get(`/ai/prospect/jobs/${jobId}/events${qs}`);
        evd = asArray(ev?.data ?? ev);
        if (!evd.length && sinceRef.current) {
          const ev0 = await api.get(`/ai/prospect/jobs/${jobId}/events`);
          evd = asArray(ev0?.data ?? ev0);
        }
      } catch {
        // non-fatal; job can still complete and preview can still load
      }

      if (evd.length) {
        setEvents((prev) => [...prev, ...evd]);
        const last = evd[evd.length - 1];
        if (last?.ts) sinceRef.current = last.ts;
      }

      // 3) inline preview when import available (retry once after completion if needed)
      const tryPreview = async (importId) => {
        if (!importId) return;
        try {
          const pv = await api.get(`/leads/imports/${importId}/items?limit=5`);
          setPreview(asArray(pv?.data ?? pv));
        } catch {}
      };

      if (jd.import_job_id) {
        await tryPreview(jd.import_job_id);
      } else if (jd.status === "completed") {
        setTimeout(async () => {
          try {
            const st2 = await api.get(`/ai/prospect/jobs/${jobId}`);
            const jd2 = st2?.data?.data || st2?.data || {};
            setJob(jd2);
            if (jd2.import_job_id) await tryPreview(jd2.import_job_id);
          } catch {}
        }, 800);
      }

      // 4) continue polling while queued/running
      if (jd?.status === "queued" || jd?.status === "running") {
        pollTimer.current = setTimeout(() => tick(jobId), 1500);
      } else {
        setBusy(false);
      }
    } catch {
      // transient errors: back off and retry unless cancelled
      if (!cancelled.current) {
        pollTimer.current = setTimeout(() => tick(jobId), 2000);
      }
    }
  }

  const goReview = () =>
    job?.import_job_id && (window.location.href = `/leads/imports/${job.import_job_id}`);

  const cancelPolling = () => {
    cancelled.current = true;
    clearTimeout(pollTimer.current);
    setBusy(false);
  };

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
            disabled={!prompt.trim() || busy}
            onClick={start}
            title={USE_FRONTEND_MOCK ? "Mock mode" : "Live (PDL) mode"}
          >
            {busy ? "Finding…" : "✨ Find Leads"}
          </button>
          {busy && (
            <button className="gg-btn gg-btn-ghost" onClick={cancelPolling}>
              Cancel
            </button>
          )}
          {!USE_FRONTEND_MOCK ? (
            <span className="text-xs gg-muted">Live mode (PDL)</span>
          ) : (
            <span className="text-xs gg-muted">Frontend mock</span>
          )}
        </div>

        {error && (
          <div className="mt-2 text-rose-400 text-sm">
            {error}
          </div>
        )}
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
                  events.map((e, idx) => (
                    <div key={e.id || e.ts || idx} className="text-sm">
                      <span className="gg-muted">
                        {e.ts ? new Date(e.ts).toLocaleTimeString() : "—"} • {e.level || "info"}
                      </span>{" "}
                      — {e.message || e.text || (typeof e === "string" ? e : JSON.stringify(e))}
                    </div>
                  ))
                ) : (
                  <div className="gg-muted text-sm">
                    {job?.status === "completed"
                      ? "Job completed but no events were returned by the server."
                      : "No events yet…"}
                  </div>
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
