// src/pages/leads/LeadsPage.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import useLeadsApi from "@/hooks/useLeadsApi";
import { useRealtime } from "@/hooks/useRealtime";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadsKanban from "@/components/leads/LeadsKanban";
import LeadsCards from "@/components/leads/LeadsCards";
import LeadDrawer from "@/components/leads/LeadDrawer";
// TEST: temporarily not using the AddLeadDrawer; keeping it here for quick revert
// import AddLeadDrawer from "@/components/leads/AddLeadDrawer";
import { useEnv } from "@/store/useEnv";
import {
  Table2,
  KanbanSquare,
  LayoutGrid,
  FileSpreadsheet,
  FileText,
  CalendarDays,
  ChevronDown,
  X,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ------------------------ Tiny UI helpers ------------------------ */

function IconPill({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={[
        "h-9 w-10 flex items-center justify-center rounded-xl transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active
          ? "bg-primary text-primary-content shadow-sm"
          : "bg-base-200/70 hover:bg-base-300/70 text-base-content/80",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SoftIcon({ color = "bg-base-200", children }) {
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${color}`}>
      {children}
    </span>
  );
}

function DateInput({ value, onChange, ariaLabel }) {
  return (
    <div className="relative">
      <input
        type="date"
        className="gg-input h-10 w-[160px] pr-10 rounded-xl"
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
      />
      <CalendarDays className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 opacity-60 pointer-events-none" />
    </div>
  );
}

/* ----------------------------- Constants ----------------------------- */

const DEFAULT_COLUMNS = [
  { key: "name",         label: "Lead",     visible: true  },
  { key: "company_name", label: "Company",  visible: true  },
  { key: "status",       label: "Status",   visible: true  },
  { key: "stage",        label: "Stage",    visible: true  },
  { key: "owner_name",   label: "Owner",    visible: true  },
  { key: "score",        label: "AI Score", visible: true  },
  { key: "priority",     label: "Priority", visible: false },
  { key: "created_at",   label: "Created",  visible: true  },
];

function todayInTZ(tz = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// FY Apr 1 → Mar 31
function currentFYRange(tz = "Asia/Kolkata") {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(m >= 3 ? y : y - 1, 3, 1);
  const end   = new Date(m >= 3 ? y + 1 : y, 2, 31);
  const fmt = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { start: fmt(start), end: fmt(end) };
}

/* ============================== Page ============================== */

export default function LeadsPage() {
  const api = useLeadsApi();
  const { leadCustomFields = [], setLeadCustomFields } = useEnv();
  const navigate = useNavigate?.();

  // View, filters, pagination
  const [view, setView]         = useState("table");
  const [query, setQuery]       = useState("");
  const [filters, setFilters]   = useState(() => {
    const today = todayInTZ();
    return { owner_id: "", stage: "", status: "", date_from: today, date_to: today };
  });
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [count, setCount]       = useState(0);

  // Sorting
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState("asc");

  // Data + UI state
  const [rows, setRows]         = useState([]);
  const [stages, setStages]     = useState([]);
  const [columns, setColumns]   = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("leads.columns"));
      return saved?.length ? saved : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });

  const [selected, setSelected]     = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openAdd, setOpenAdd]       = useState(false);
  const [addKey, setAddKey]         = useState(0);

  const [loading, setLoading]       = useState(false);

  // AI refresh state (page-scope)
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });

  const [aiBusyIds, setAiBusyIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Search hotkeys
  const searchRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Realtime updates
  useRealtime({
    onLeadEvent: (evt) => {
      if (!evt?.lead) return;
      setRows(prev => {
        const idx = prev.findIndex(r => r.id === evt.lead.id);
        if (idx === -1) return [evt.lead, ...prev];
        const next = prev.slice();
        next[idx] = { ...prev[idx], ...evt.lead };
        return next;
      });
    },
  });

  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  // Date presets
  const datePresets = useMemo(() => {
    const iso = (d) => new Date(d).toISOString().slice(0, 10);
    const today = new Date();
    const last7 = new Date(today); last7.setDate(today.getDate() - 6);
    const last30 = new Date(today); last30.setDate(today.getDate() - 29);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const fy = currentFYRange();
    return [
      { key: "7d",  label: "Last 7 days",  from: iso(last7),  to: iso(today) },
      { key: "30d", label: "Last 30 days", from: iso(last30), to: iso(today) },
      { key: "mtd", label: "This month",   from: iso(monthStart), to: iso(today) },
      { key: "fy",  label: "This FY",      from: fy.start, to: fy.end },
    ];
  }, []);

  // API params (legacy + premium)
  const params = useMemo(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const premium = {
      search_query: query?.trim() || undefined,
      filter_stage:  filters.stage || undefined,
      filter_status: filters.status || undefined,
      filter_owner_id: filters.owner_id || undefined,
      filter_date_from: filters.date_from || undefined,
      filter_date_to: filters.date_to || undefined,

      page_number: page,
      page_size: pageSize,
      sort_by: sortKey || undefined,
      sort_direction: sortDir || undefined,
      view_type: view,
      visible_columns: visibleColumns.map(c => c.key),
      timezone,
      include_ai_insights: true,
      include_related_entities: ["company", "owner"],
    };

    const legacy = {
      q: query || undefined,
      stage: filters.stage || undefined,
      status: filters.status || undefined,
      owner_id: filters.owner_id || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,

      page, pageSize,
      sort: sortKey || undefined,
      dir:  sortDir || undefined,
      view,
    };

    const merged = { ...legacy, ...premium };
    return Object.fromEntries(Object.entries(merged).filter(([,v]) => v !== undefined));
  }, [query, filters, page, pageSize, sortKey, sortDir, view, visibleColumns]);

  /* ------------------------------ Fetchers ------------------------------ */

  const apiList = useCallback(async () => {
    setLoading(true);
    try {
      const data  = await api.listLeads(params);
      if (!mountedRef.current) return;
      const items = data.items || data.rows || [];
      setRows(items);
      setCount(Number(data.total ?? data.totalCount ?? items.length ?? 0));
      } catch (err) {
     // Ignore request cancels; surface anything else
     if (axios.isCancel?.(err) || err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
       // no-op
     } else {
       console.error(err);
     }
    } finally {
      mountedRef.current && setLoading(false);
    }
  }, [api, params]);

  const fetchPipelines = useCallback(async () => {
    try {
     const data = await api.listPipelines();
     if (!mountedRef.current) return;
     const arr = data?.stages || data || [];
     setStages(Array.isArray(arr) && arr.length ? arr : ["new","prospect","proposal","negotiation","closed"]);
   } catch (e) {
     // Try an alternate path if your backend exposes CRM pipelines there
     try {
       const res = await axios.get("/api/crm/pipelines");
       if (!mountedRef.current) return;
       const arr = res?.data?.stages || res?.data || [];
       setStages(Array.isArray(arr) && arr.length ? arr : ["new","prospect","proposal","negotiation","closed"]);
     } catch {
       if (mountedRef.current) setStages(["new","prospect","proposal","negotiation","closed"]);
     }
   }
    
  }, [api]);

  const fetchLeadCustomFields = useCallback(async () => {
    try {
      const res = await axios.get("/api/crm/custom-fields", {
        params: { entity: "lead" },
        withCredentials: true,
      });

      const raw = Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data)
        ? res.data
        : [];

      const items = raw.map((f) => ({ ...f, group: f?.group === "advance" ? "advance" : "general" }));
      setLeadCustomFields?.(items);
    } catch {
      setLeadCustomFields?.([]);
    }
  }, [setLeadCustomFields]);

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);
  useEffect(() => { apiList(); }, [apiList]);
  useEffect(() => { fetchLeadCustomFields(); }, [fetchLeadCustomFields]);

  /* --------------------------- Client-side sort -------------------------- */

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const normalize = (v) => {
      if (v == null) return "";
      if (typeof v === "number") return v;
      if (sortKey.includes("date") || sortKey.includes("created")) {
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? 0 : t;
      }
      return String(v).toLowerCase();
    };
    const arr = [...rows];
    arr.sort((a,b) => {
      const va = normalize(a[sortKey]);
      const vb = normalize(b[sortKey]);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  /* ------------------------------ Actions ------------------------------- */

  const onInlineUpdate = async (id, patch) => {
    await api.updateLead(id, patch);
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const onMoveStage = async ({ id, toStage }) => {
    await api.updateLead(id, { stage: toStage });
    setRows(prev => prev.map(r => (r.id === id ? { ...r, stage: toStage } : r)));
  };

  const onOpenLead = (id) => { setSelected(id); setOpenDrawer(true); };

  const onAddSuccess = (newLead) => {
    setOpenAdd(false);
    if (newLead?.id) {
      setRows(prev => [newLead, ...prev]);
      setCount(c => c + 1);
      setView("table");
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    }
  };

  // TEST: open the CFV form page instead of the Add Lead drawer
  const openAddDrawer = () => {
    // keep old behavior commented for easy revert:
    // setAddKey(k => k + 1);
    // setOpenAdd(true);
    try {
      if (navigate) navigate("/cfv/new");
      else window.location.assign("/cfv/new");
    } catch {
      window.location.assign("/cfv/new");
    }
  };

  const toggleColumn = (key) => {
    setColumns(prev => {
      const next = prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
      localStorage.setItem("leads.columns", JSON.stringify(next));
      return next;
    });
  };

  const setAllColumns = (visible) => {
    setColumns(prev => {
      const next = prev.map(c => ({ ...c, visible }));
      localStorage.setItem("leads.columns", JSON.stringify(next));
      return next;
    });
  };

  const resetColumns = () => {
    localStorage.setItem("leads.columns", JSON.stringify(DEFAULT_COLUMNS));
    setColumns(DEFAULT_COLUMNS);
  };

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const onAiRefreshRow = useCallback(async (id) => {
    setAiBusyIds(prev => { const s = new Set(prev); s.add(id); return s; });
    try {
      await api.aiRefresh(id);
      const full = await api.getLead(id).catch(() => null);
      if (mountedRef.current && full) {
        setRows(prev => prev.map(r => (r.id === id ? { ...r, ...full } : r)));
      }
    } finally {
      if (mountedRef.current) {
        setAiBusyIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      }
    }
  }, [api]);

  const refreshAIForVisible = useCallback(async () => {
    const ids = (rows || []).map(r => r.id).filter(Boolean);
    if (!ids.length) return;
    setAiRefreshing(true);
    setAiProgress({ done: 0, total: ids.length });
    setAiBusyIds(new Set(ids));

    const concurrency = 3;
    const queue = [...ids];
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          await api.aiRefresh(id);
          const full = await api.getLead(id).catch(() => null);
          if (mountedRef.current && full) {
            setRows(prev => prev.map(r => (r.id === id ? { ...r, ...full } : r)));
          }
        } finally {
          done += 1;
          if (mountedRef.current) {
            setAiProgress({ done, total: ids.length });
            setAiBusyIds(prev => { const s = new Set(prev); s.delete(id); return s; });
          }
        }
      }
    };
    await Promise.all(new Array(concurrency).fill(0).map(worker));
    if (mountedRef.current) setAiRefreshing(false);
  }, [api, rows]);

  /* ---------------------------- Export helpers --------------------------- */

  const exportFileBase = () => {
    const from = (filters.date_from || "all");
    const to   = (filters.date_to   || "all");
    return `leads_${from}_to_${to}`;
  };

  const fetchAllForExport = async () => {
    const pageSize = 5000;
    let pageNum = 1;
    let all = [];
    while (true) {
      const data = await api.listLeads({ ...params, page_number: pageNum, page_size: pageSize });
      const items = data.items || data.rows || [];
      all = all.concat(items);
      const total = Number(data.total ?? data.totalCount ?? all.length);
      if (all.length >= total || items.length < pageSize) break;
      pageNum += 1;
    }
    return all;
  };

  const buildExportRows = (rowsArg) => {
    const cols = visibleColumns;
    const header = cols.map(c => c.label);
    const records = rowsArg.map(r =>
      cols.map(c => {
        const v = r[c.key];
        if (v == null) return "";
        if (c.key.includes("date") || c.key.includes("created")) {
          const t = new Date(v);
          return Number.isNaN(t.getTime()) ? String(v) : t.toLocaleString();
        }
        return typeof v === "object" ? JSON.stringify(v) : String(v);
      })
    );
    return { header, records };
  };

  const exportCSV = async () => {
    const all = await fetchAllForExport();
    const { header, records } = buildExportRows(all);
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [header.map(esc).join(","), ...records.map(row => row.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${exportFileBase()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAllForExport();
      const { header, records } = buildExportRows(all);
      try {
        const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
        const sheetData = [header, ...records];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        XLSX.writeFile(wb, `${exportFileBase()}.xlsx`);
      } catch {
        await exportCSV();
      }
    } finally { setExporting(false); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const all = await fetchAllForExport();
      const { header, records } = buildExportRows(all);
      const title = `Leads (${filters.date_from || "all"} → ${filters.date_to || "all"})`;
      try {
        const jspdfMod = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm");
        const autoMod  = await import("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm");
        const jsPDF    = jspdfMod.jsPDF || jspdfMod.default?.jsPDF || jspdfMod.default;
        const autoTable = autoMod.default || autoMod;
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(12);
        doc.text(title, 14, 12);
        autoTable(doc, { head: [header], body: records, startY: 18, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [33, 150, 243] } });
        doc.save(`${exportFileBase()}.pdf`);
      } catch {
        // Fallback printable HTML
        const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
        const html = `
          <html><head><title>${title}</title>
          <style>body{font-family:system-ui,sans-serif;padding:16px}
          table{border-collapse:collapse;width:100%;font-size:12px}
          th,td{border:1px solid #ccc;padding:6px 8px;text-align:left} th{background:#f2f2f2}</style>
          </head><body><h3>${title}</h3><table>
          <thead><tr>${header.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${records.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table><script>window.onload=()=>window.print()</script></body></html>`;
        const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
      }
    } finally { setExporting(false); }
  };

  /* ------------------------ Misc small helpers ------------------------ */

  const viewSelect = (
    <select
      aria-label="View"
      className="gg-input md:hidden rounded-xl"
      value={view}
      onChange={(e)=>setView(e.target.value)}
    >
      <option value="table">Table</option>
      <option value="kanban">Kanban</option>
      <option value="cards">Cards</option>
    </select>
  );

  const chips = useMemo(() => {
    const out = [];
    if (filters.stage)  out.push({ k: "stage",  label: `Stage: ${filters.stage}`,  clear: () => setFilters(f => ({ ...f, stage: "" })) });
    if (filters.status) out.push({ k: "status", label: `Status: ${filters.status}`, clear: () => setFilters(f => ({ ...f, status: "" })) });
    if (filters.date_from && filters.date_to) {
      out.push({ k: "range", label: `${filters.date_from} → ${filters.date_to}`, clear: () => setFilters(f => ({ ...f, date_from: "", date_to: "" })) });
    }
    if (query) out.push({ k: "q", label: `“${query}”`, clear: () => setQuery("") });
    return out;
  }, [filters, query]);

  /* ------------------------------ Render ------------------------------ */

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[color:var(--text)]">
      <div className="p-4 flex flex-col gap-4">

        {/* Sticky, glassy header / toolbar */}
        <div className="sticky top-0 z-20">
          <div className="gg-panel rounded-2xl shadow-xl backdrop-blur-xl bg-base-100/70">
            <div className="px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">Leads</h1>
                <span className="text-sm text-[color:var(--muted)]">({count})</span>
              </div>

              <div className="flex items-center gap-2">
                {viewSelect}

                {/* View segmented control — now visible on all breakpoints */}
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-base-200/60" role="group" aria-label="Change leads view">
                  <IconPill title="Table"  active={view === "table"}  onClick={() => setView("table")}>
                    <Table2 className="w-4 h-4" />
                  </IconPill>
                  <IconPill title="Kanban" active={view === "kanban"} onClick={() => setView("kanban")}>
                    <KanbanSquare className="w-4 h-4" />
                  </IconPill>
                  <IconPill title="Cards"  active={view === "cards"}  onClick={() => setView("cards")}>
                    <LayoutGrid className="w-4 h-4" />
                  </IconPill>
                </div>

                <button
                  className="gg-btn rounded-xl"
                  disabled={aiRefreshing || rows.length === 0}
                  onClick={refreshAIForVisible}
                  title="Run AI summary/next actions for all leads on this page"
                >
                  {aiRefreshing ? `AI Refresh… (${aiProgress.done}/${aiProgress.total})` : "AI Refresh (Page)"}
                </button>

                <button className="gg-btn gg-btn-primary rounded-xl" onClick={openAddDrawer}>
                  + Add Lead
                </button>
              </div>
            </div>

            {/* Filters row */}
            <div className="px-4 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                {/* Dates + Presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <DateInput
                    value={filters.date_from}
                    onChange={(e) => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1); }}
                    ariaLabel="From date"
                  />
                  <span className="opacity-40">–</span>
                  <DateInput
                    value={filters.date_to}
                    onChange={(e) => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
                    ariaLabel="To date"
                  />

                  <div className="dropdown">
                    <label tabIndex={0} className="gg-btn gg-btn-ghost h-10 min-h-10 gap-1 rounded-xl cursor-pointer">
                      Presets <ChevronDown className="w-4 h-4" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content gg-panel mt-2 w-56 p-2 z-[60] rounded-xl">
                      {datePresets.map(p => (
                        <li key={p.key}>
                          <button
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-base-200"
                            onClick={() => setFilters(f => ({ ...f, date_from: p.from, date_to: p.to }))}
                          >
                            {p.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Search */}
                <div className="relative w-full lg:w-80">
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder="Search leads, company, contact…  (/ to focus)"
                    className="gg-input h-10 pl-3 pr-14 rounded-xl w-full"
                    aria-label="Search leads"
                  />
                  <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded bg-base-200/90 border border-base-300">
                    /
                  </kbd>
                </div>

                {/* Stage & Status */}
                <div className="flex gap-2">
                  <select
                    className="gg-input h-10 rounded-xl"
                    value={filters.stage}
                    onChange={(e) => { setFilters(f => ({ ...f, stage: e.target.value || "" })); setPage(1); }}
                    aria-label="Stage"
                  >
                    <option value="">All Stages</option>
                    {stages?.map(s => (<option key={s} value={s}>{s}</option>))}
                  </select>

                  <select
                    className="gg-input h-10 rounded-xl"
                    value={filters.status}
                    onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value || "" })); setPage(1); }}
                    aria-label="Status"
                  >
                    <option value="">All Status</option>
                    <option value="new">New</option>
                    <option value="qualified">Qualified</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 lg:ml-auto">
                  {/* Export split + menu with strong icon accents */}
                  <div className="dropdown dropdown-end">
                    <button type="button" className="gg-btn rounded-xl gap-2">
                      <SoftIcon color="bg-emerald-500/15"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /></SoftIcon>
                      <span>Export</span>
                      <ChevronDown className="w-4 h-4 opacity-70" />
                    </button>
                    <ul className="dropdown-content gg-panel mt-2 w-48 p-2 z-[60] rounded-xl">
                      <li>
                        <button className="w-full px-2 py-2 rounded-lg hover:bg-base-200 flex items-center gap-2" onClick={exportExcel}>
                          <SoftIcon color="bg-emerald-500/15"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /></SoftIcon> Excel (.xlsx)
                        </button>
                      </li>
                      <li>
                        <button className="w-full px-2 py-2 rounded-lg hover:bg-base-200 flex items-center gap-2" onClick={exportPDF}>
                          <SoftIcon color="bg-rose-500/15"><FileText className="w-4 h-4 text-rose-600" /></SoftIcon> PDF
                        </button>
                      </li>
                      <li>
                        <button className="w-full px-2 py-2 rounded-lg hover:bg-base-200 flex items-center gap-2" onClick={exportCSV}>
                          <SoftIcon color="bg-sky-500/15"><Download className="w-4 h-4 text-sky-600" /></SoftIcon> CSV
                        </button>
                      </li>
                    </ul>
                  </div>

                  <button
                    className="gg-btn gg-btn-ghost rounded-xl"
                    onClick={() => {
                      const today = todayInTZ();
                      setFilters({ owner_id: "", stage: "", status: "", date_from: today, date_to: today });
                      setQuery("");
                      setPage(1);
                    }}
                  >
                    Reset
                  </button>

                  <details className="relative">
                    <summary className="gg-btn rounded-xl cursor-pointer select-none">Columns</summary>
                    <ul className="gg-panel absolute right-0 mt-2 w-64 p-2 z-[60] rounded-xl">
                      <li className="px-2 py-1.5 flex gap-2">
                        <button className="gg-btn gg-btn-ghost h-8 min-h-8 px-2 text-xs rounded-lg" onClick={() => setAllColumns(true)}>Select all</button>
                        <button className="gg-btn gg-btn-ghost h-8 min-h-8 px-2 text-xs rounded-lg" onClick={resetColumns}>Reset defaults</button>
                      </li>
                      <li className="h-px bg-base-300 my-1" />
                      {columns.map(c => (
                        <li key={c.key} className="px-2 py-1.5">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={c.visible}
                              onChange={() => toggleColumn(c.key)}
                              className="accent-[var(--primary)]"
                            />
                            <span className="text-sm">{c.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>

              {/* Active filter chips */}
              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {chips.map(ch => (
                    <span key={ch.k} className="badge badge-outline gap-1 rounded-lg">
                      {ch.label}
                      <button className="ml-1 hover:text-error" onClick={ch.clear} title="Clear">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {view === "table" && (
            <LeadsTable
              loading={loading}
              rows={sortedRows}
              columns={visibleColumns}
              page={page}
              pageSize={pageSize}
              total={count}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onInlineUpdate={onInlineUpdate}
              onOpenLead={onOpenLead}
              onAiRefreshRow={onAiRefreshRow}
              aiRefreshingIds={aiBusyIds}
            />
          )}

          {view === "kanban" && (
            <LeadsKanban
              loading={loading}
              rows={rows}
              stages={stages}
              onMoveStage={onMoveStage}
              onOpenLead={onOpenLead}
            />
          )}

          {view === "cards" && (
            <LeadsCards
              loading={loading}
              rows={sortedRows}
              onOpenLead={onOpenLead}
            />
          )}
        </div>

        {/* Drawers */}
        {openDrawer && (
          <LeadDrawer
            id={selected}
            onClose={() => setOpenDrawer(false)}
            onUpdated={(patch) => onInlineUpdate(selected, patch)}
          />
        )}

        {/* TEST: routing to /cfv/new on Add Lead click. Keeping the drawer code below for quick revert. */}
        {/*
        {openAdd && (
          <AddLeadDrawer
            key={addKey}
            stages={stages}
            sources={["Website","Referral","Ads","Outbound","Event"]}
            customFields={leadCustomFields}
            onClose={() => setOpenAdd(false)}
            onSuccess={onAddSuccess}
          />
        )}
        */}
      </div>
    </div>
  );
}
