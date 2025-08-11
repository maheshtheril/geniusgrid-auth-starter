// src/pages/LeadsPage.jsx
// Futuristic, world-class Leads list with AI integrations and navigation-ready.
// - Drop into your project and add a route: <Route path="/app/crm/leads" element={<LeadsPage/>} />
// - Uses Tailwind, lucide-react, and minimal fetch wiring (swap API_BASE if needed)
// - Features: global search, filters, column chooser, pagination, inline status, row actions,
//             AI summary + next actions, AI refresh button, and a right-side AI drawer.
// - No menu logic touched. Pure page-level UI.

import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Settings2,
  ListFilter,
  BadgeCheck,
  X,
  Loader2,
  Phone,
  Mail,
  ArrowUpDown,
  Info,
} from "lucide-react";

/* --------------------------- config & helpers --------------------------- */
const API_BASE = import.meta.env.VITE_API_URL || ""; // same-origin if empty
const PAGE_SIZES = [10, 25, 50, 100];

function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "lost", label: "Lost" },
];

/* ------------------------------ API client ------------------------------ */
async function fetchLeads({ page, size, q, filters }) {
  const params = new URLSearchParams({ page, size, q: q || "" });
  if (filters?.status) params.set("status", filters.status);
  if (filters?.owner) params.set("owner", filters.owner);
  const url = `${API_BASE}/api/leads?${params.toString()}`.replace(/([^:]\/)+\/+/, "$1");
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Leads HTTP ${res.status}`);
  return res.json();
}

async function updateLeadStatus(id, status) {
  const url = `${API_BASE}/api/leads/${id}`.replace(/([^:]\/)+\/+/, "$1");
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Lead PATCH ${res.status}`);
  return res.json();
}

async function refreshLeadAI(id) {
  const url = `${API_BASE}/api/leads/${id}/ai-refresh`.replace(/([^:]\/)+\/+/, "$1");
  const res = await fetch(url, { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`AI refresh ${res.status}`);
  return res.json();
}

/* ------------------------------ Main page ------------------------------ */
export default function LeadsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  // query state
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ status: "", owner: "" });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);

  // data
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ui
  const [showColumns, setShowColumns] = useState(false);
  const [columns, setColumns] = useState([
    { key: "name", label: "Lead", visible: true, sortable: true },
    { key: "company", label: "Company", visible: true, sortable: true },
    { key: "email", label: "Email", visible: true },
    { key: "phone", label: "Phone", visible: true },
    { key: "status", label: "Status", visible: true },
    { key: "score", label: "AI Score", visible: true, sortable: true },
    { key: "owner", label: "Owner", visible: true },
    { key: "updated_at", label: "Updated", visible: true, sortable: true },
  ]);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLead, setAiLead] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  // sorting
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortDir, setSortDir] = useState("desc");

  // derive
  const visibleCols = useMemo(() => columns.filter((c) => c.visible), [columns]);
  const pages = Math.max(1, Math.ceil(total / size));

  // read query params on mount (optional deep link support)
  useEffect(() => {
    const sp = new URLSearchParams(search);
    const initialQ = sp.get("q") || "";
    if (initialQ) setQ(initialQ);
  }, [search]);

  // load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetchLeads({ page, size, q, filters });
        if (!alive) return;
        setRows(res.items || res.data || res.rows || []);
        setTotal(res.total || res.count || 0);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load leads");
        setRows([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [page, size, q, filters]);

  // handlers
  const toggleColumn = (key) => {
    setColumns((cols) => cols.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  const onSort = (key) => {
    const col = columns.find((c) => c.key === key && c.sortable);
    if (!col) return;
    setSortBy(key);
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setRows((r) =>
      [...r].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      })
    );
  };

  const openAi = (lead) => {
    setAiLead(lead);
    setAiOpen(true);
  };

  const runAiRefresh = async (lead) => {
    try {
      setAiBusy(true);
      const res = await refreshLeadAI(lead.id);
      // optimistic patch
      setRows((rows) =>
        rows.map((r) => (r.id === lead.id ? { ...r, score: res.score ?? r.score, ai_summary: res.ai_summary ?? r.ai_summary, ai_next: res.ai_next ?? r.ai_next } : r))
      );
    } catch (e) {
      console.error(e);
      alert("AI refresh failed");
    } finally {
      setAiBusy(false);
    }
  };

  const changeStatus = async (lead, status) => {
    try {
      const res = await updateLeadStatus(lead.id, status);
      setRows((rows) => rows.map((r) => (r.id === lead.id ? { ...r, status: res.status ?? status } : r)));
    } catch (e) {
      console.error(e);
      alert("Status update failed");
    }
  };

  const goCreate = () => navigate("/app/crm/leads/new");

  /* ------------------------------ UI blocks ----------------------------- */
  return (
    <div className="h-full w-full flex flex-col">
      {/* Topbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/50 backdrop-blur">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 w-full max-w-xl bg-white/60 dark:bg-zinc-900/50">
          <Search className="h-4 w-4 opacity-70" />
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Search leads, company, email, phone…"
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          onClick={() => setShowColumns((s) => !s)}
          title="Columns"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden md:inline">Columns</span>
        </button>

        <div className="hidden md:flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-2 py-1.5 text-sm">
            <ListFilter className="h-4 w-4" />
            <select
              value={filters.status}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, status: e.target.value }));
              }}
              className="bg-transparent text-sm outline-none"
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={goCreate}
          className="ml-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Lead</span>
        </button>
      </div>

      {/* Columns popover */}
      {showColumns && (
        <div className="z-10 m-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-3 w-fit shadow-xl backdrop-blur">
          <div className="text-xs font-semibold text-zinc-500 mb-2">Visible Columns</div>
          <div className="grid grid-cols-2 gap-2">
            {columns.map((c) => (
              <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.visible}
                  onChange={() => toggleColumn(c.key)}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/50 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200/60 dark:border-zinc-800/60 text-zinc-500">
                  {visibleCols.map((c) => (
                    <th key={c.key} className="text-left px-4 py-3 font-medium select-none">
                      <button
                        className={classNames(
                          "inline-flex items-center gap-1 hover:underline",
                          c.sortable && "cursor-pointer"
                        )}
                        onClick={() => c.sortable && onSort(c.key)}
                        title={c.sortable ? `Sort by ${c.label}` : undefined}
                      >
                        {c.label}
                        {c.sortable && <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={visibleCols.length + 1} className="px-4 py-10 text-center text-zinc-500">
                      <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Loading leads…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={visibleCols.length + 1} className="px-4 py-10 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length + 1} className="px-4 py-16 text-center text-zinc-500">
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-900/[0.02] dark:hover:bg-white/[0.02]">
                      {visibleCols.map((c) => (
                        <td key={c.key} className="px-4 py-2 align-middle">
                          {c.key === "name" && (
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-sky-500/20 grid place-items-center">
                                <BadgeCheck className="h-4 w-4 opacity-70" />
                              </div>
                              <div>
                                <div className="font-medium">{r.name || "—"}</div>
                                <div className="text-xs text-zinc-500">#{r.id?.slice?.(0, 8) || r.id}</div>
                              </div>
                            </div>
                          )}
                          {c.key === "company" && <span>{r.company || "—"}</span>}
                          {c.key === "email" && (
                            <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${r.email || ""}`}>
                              <Mail className="h-3.5 w-3.5" /> {r.email || "—"}
                            </a>
                          )}
                          {c.key === "phone" && (
                            <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${r.phone || ""}`}>
                              <Phone className="h-3.5 w-3.5" /> {r.phone || "—"}
                            </a>
                          )}
                          {c.key === "status" && (
                            <select
                              value={r.status || "new"}
                              onChange={(e) => changeStatus(r, e.target.value)}
                              className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-transparent px-2 py-1 text-sm"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                          {c.key === "score" && (
                            <div className="inline-flex items-center gap-2">
                              <span className="font-semibold">{r.score ?? "—"}</span>
                              {r.score != null && (
                                <span className="text-[10px] rounded px-1.5 py-0.5 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                                  AI
                                </span>
                              )}
                            </div>
                          )}
                          {c.key === "owner" && <span>{r.owner || "—"}</span>}
                          {c.key === "updated_at" && (
                            <span>{r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openAi(r)}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs border border-zinc-200/70 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            title="AI summary"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> AI
                          </button>
                          <button
                            onClick={() => runAiRefresh(r)}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20"
                            title="Refresh AI"
                            disabled={aiBusy}
                          >
                            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div className="text-xs text-zinc-500">
              Page {page} of {pages} • {total} leads
            </div>
            <div className="flex items-center gap-2">
              <select
                value={size}
                onChange={(e) => {
                  setPage(1);
                  setSize(Number(e.target.value));
                }}
                className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 bg-transparent px-2 py-1 text-sm"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                disabled={page >= pages}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI drawer */}
      {aiOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAiOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-zinc-950 border-l border-zinc-200/70 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="font-semibold">AI Insights</div>
              <button onClick={() => setAiOpen(false)} className="rounded-lg border border-zinc-200/70 dark:border-zinc-800 px-2 py-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-52px)]">
              {!aiLead ? (
                <div className="text-zinc-500 text-sm">No lead selected.</div>
              ) : (
                <>
                  <div className="rounded-xl p-3 border border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-900/10">
                    <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-1">Summary</div>
                    <div className="text-sm whitespace-pre-wrap">
                      {aiLead.ai_summary || "No AI summary yet. Click Refresh."}
                    </div>
                  </div>
                  <div className="rounded-xl p-3 border border-sky-500/30 bg-sky-50/40 dark:bg-sky-900/10">
                    <div className="text-xs uppercase tracking-wider text-sky-600 dark:text-sky-300 mb-1">Next Actions</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {(aiLead.ai_next || []).length ? (
                        aiLead.ai_next.map((t, i) => <li key={i}>{t}</li>)
                      ) : (
                        <li>No AI suggestions yet.</li>
                      )}
                    </ul>
                  </div>
                  <button
                    onClick={() => runAiRefresh(aiLead)}
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow hover:opacity-95"
                    disabled={aiBusy}
                  >
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Refresh AI
                  </button>
                </>
              )}
              <div className="text-xs text-zinc-500 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5" />
                AI features assume your backend endpoints exist (`/api/leads/:id/ai-refresh`) and return `{ score, ai_summary, ai_next }`.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
