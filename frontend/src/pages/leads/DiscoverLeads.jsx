// src/pages/leads/DiscoverLeads.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js"; // shared API (baseURL + credentials)

// ✅ Flip this to false to go back to real API
const USE_FRONTEND_MOCK = true;

// Simple Indian mock data for the inline preview table
function makeIndianPreview(size = 5) {
  const base = [
    {
      id: "IN-001",
      name: "Priya Sharma",
      title: "Procurement Manager",
      company: "Aarav Auto Components Pvt Ltd",
      email: "priya.sharma@aaravauto.in",
    },
    {
      id: "IN-002",
      name: "Rohan Iyer",
      title: "Finance Controller",
      company: "Kaveri Textiles Ltd",
      email: "rohan.iyer@kaveritextiles.in",
    },
    {
      id: "IN-003",
      name: "Neha Gupta",
      title: "Operations Head",
      company: "Vistara Foods Pvt Ltd",
      email: "neha.gupta@vistarafoods.in",
    },
    {
      id: "IN-004",
      name: "Arjun Mehta",
      title: "Supply Chain Lead",
      company: "Indus Machinery Works",
      email: "arjun.mehta@indusmw.in",
    },
    {
      id: "IN-005",
      name: "Ananya Rao",
      title: "Plant Admin",
      company: "Sahyadri Ceramics",
      email: "ananya.rao@sahyadri-ceramics.in",
    },
  ];
  // repeat/trim to requested size
  const out = [];
  for (let i = 0; i < size; i++) {
    const t = base[i % base.length];
    out.push({
      ...t,
      id: `${t.id}-${Math.floor(i / base.length) + 1}`,
    });
  }
  return out.slice(0, size);
}

// Simple mock event list (what your UI shows in the left column)
function makeMockEvents() {
  const now = Date.now();
  const mk = (ms, level, message) => ({
    id: String(now + ms),
    ts: new Date(now + ms).toISOString(),
    level,
    message,
  });
  return [
    mk(0, "info", "Queued: discovering Indian mid-market manufacturers"),
    mk(600, "info", "Running: searching procurement, finance & operations titles"),
    mk(1400, "info", "Enriching leads with email & company metadata"),
    mk(2200, "success", "Completed: mock data ready to review"),
  ];
}

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

    // ---------------- FRONTEND MOCK: no server, just show Indian data ----------------
    if (USE_FRONTEND_MOCK) {
      clearTimeout(pollTimer.current);
      setEvents([]);
      setPreview([]);
      sinceRef.current = null;

      // simulate a short delay so it feels "AI-ish"
      const mockJobId = "mock-job-IND-1";
      setJob({ id: mockJobId, status: "queued", import_job_id: "mock-import-IND-1" });

      // emit staged events and final data
      const evs = makeMockEvents();
      // progressively show events
      evs.forEach((e, idx) => {
        setTimeout(() => {
          setEvents((prev) => [...prev, e]);
          setJob((j) => ({ ...(j || {}), status: idx < evs.length - 1 ? "running" : "completed" }));
        }, idx * 500);
      });

      // inline preview of first few items (from India)
      setTimeout(() => {
        const firstFive = makeIndianPreview(5);
        setPreview(firstFive);
        // mark job as completed at the end
        setJob({ id: mockJobId, status: "completed", import_job_id: "mock-import-IND-1" });
      }, 1700);

      return; // <-- stop here; do not call the backend
    }
    // ---------------- END FRONTEND MOCK ----------------

    // ---------------- ORIGINAL NETWORK CODE (kept, just commented) ----------------
    // const { data } = await api.post("/ai/prospect/jobs", {
    //   prompt,
    //   size,
    //   providers: ["pdl"],
    //   filters: {},
    // });
    // const j = data?.data || data;
    // setJob(j);
    // setEvents([]);
    // setPreview([]);
    // sinceRef.current = null;
    // clearTimeout(pollTimer.current);
    // tick(j.id);
    // ---------------- END ORIGINAL ----------------
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
