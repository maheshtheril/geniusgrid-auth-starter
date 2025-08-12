// src/pages/leads/LeadsPage.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import useLeadsApi from "@/hooks/useLeadsApi";
import { useRealtime } from "@/hooks/useRealtime";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadsKanban from "@/components/leads/LeadsKanban";
import LeadsCards from "@/components/leads/LeadsCards";
import LeadDrawer from "@/components/leads/LeadDrawer";
import AddLeadDrawer from "@/components/leads/AddLeadDrawer";
import { useEnv } from "@/store/useEnv";

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

export default function LeadsPage() {
  const api = useLeadsApi();
  const { leadCustomFields = [], setLeadCustomFields } = useEnv();

  // View, filters, pagination
  const [view, setView]         = useState("table");
  const [query, setQuery]       = useState("");
  const [filters, setFilters]   = useState({ owner_id: "", stage: "", status: "" });
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

  // Remount Add drawer each open to clear form state
  const [openAdd, setOpenAdd]       = useState(false);
  const [addKey, setAddKey]         = useState(0);

  const [loading, setLoading]       = useState(false);

  // AI refresh state (page-scope)
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });

  // NEW: per-row busy ids for inline AI refresh button
  const [aiBusyIds, setAiBusyIds] = useState(() => new Set());

  // Mounted guard
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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

  // Params (legacy + premium)
  const params = useMemo(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const premium = {
      search_query: query?.trim() || undefined,
      filter_stage:  filters.stage || undefined,
      filter_status: filters.status || undefined,
      filter_owner_id: filters.owner_id || undefined,
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
      page, pageSize,
      sort: sortKey || undefined,
      dir:  sortDir || undefined,
      view,
    };

    const merged = { ...legacy, ...premium };
    return Object.fromEntries(Object.entries(merged).filter(([,v]) => v !== undefined));
  }, [query, filters, page, pageSize, sortKey, sortDir, view, visibleColumns]);

  // Fetchers
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data  = await api.listLeads(params);
      if (!mountedRef.current) return;
      const items = data.items || data.rows || [];
      setRows(items);
      setCount(Number(data.total ?? data.totalCount ?? items.length ?? 0));
    } finally {
      mountedRef.current && setLoading(false);
    }
  }, [api, params]);

  const fetchPipelines = useCallback(async () => {
    try {
      const data = await api.listPipelines();
      if (!mountedRef.current) return;
      setStages(data.stages || data || []);
    } catch {/* swallow */}
  }, [api]);

  // Fetch lead custom fields once (normalize group -> 'general')
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

      const items = raw.map((f) => ({
        ...f,
        group: f?.group === "advance" ? "advance" : "general",
      }));

      setLeadCustomFields?.(items);
    } catch {
      setLeadCustomFields?.([]);
    }
  }, [setLeadCustomFields]);

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchLeadCustomFields(); }, [fetchLeadCustomFields]);

  // Client-side sorting (stable)
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

  // Actions
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

  const openAddDrawer = () => {
    setAddKey(k => k + 1);
    setOpenAdd(true);
  };

  const toggleColumn = (key) => {
    setColumns(prev => {
      const next = prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
      localStorage.setItem("leads.columns", JSON.stringify(next));
      return next;
    });
  };

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  // ---- Per-row AI refresh (used by table's inline button) ----
  const onAiRefreshRow = useCallback(async (id) => {
    setAiBusyIds(prev => {
      const s = new Set(prev);
      s.add(id);
      return s;
    });
    try {
      await api.aiRefresh(id);
      // fetch the freshly-updated lead so table shows newest ai_summary/ai_score/etc.
      const full = await api.getLead(id).catch(() => null);
      if (mountedRef.current && full) {
        setRows(prev => prev.map(r => (r.id === id ? { ...r, ...full } : r)));
      }
    } finally {
      if (mountedRef.current) {
        setAiBusyIds(prev => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    }
  }, [api]);

  // ---- AI Refresh (current page) ----
  const refreshAIForVisible = useCallback(async () => {
    const ids = (rows || []).map(r => r.id).filter(Boolean);
    if (!ids.length) return;
    setAiRefreshing(true);
    setAiProgress({ done: 0, total: ids.length });
    // mark all busy
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
        } catch {
          // ignore individual errors
        } finally {
          done += 1;
          if (mountedRef.current) {
            setAiProgress({ done, total: ids.length });
            setAiBusyIds(prev => {
              const s = new Set(prev);
              s.delete(id);
              return s;
            });
          }
        }
      }
    };

    await Promise.all(new Array(concurrency).fill(0).map(worker));
    if (mountedRef.current) setAiRefreshing(false);
  }, [api, rows]);

  // Compact view selector for small screens
  const viewSelect = (
    <select
      aria-label="View"
      className="gg-input md:hidden"
      value={view}
      onChange={(e)=>setView(e.target.value)}
    >
      <option value="table">Table</option>
      <option value="kanban">Kanban</option>
      <option value="cards">Cards</option>
    </select>
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[color:var(--text)]">
      <div className="p-4 flex flex-col gap-4">

        {/* Header */}
        <div className="gg-panel shadow-xl p-4 rounded-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Leads</h1>
              <span className="text-sm text-[color:var(--muted)]">({count})</span>
            </div>

            <div className="flex items-center gap-2">
              {viewSelect}

              <div className="hidden md:inline-flex rounded-lg overflow-hidden border border-[color:var(--border)]">
                <button className={`gg-btn ${view==='table' ? 'gg-btn-primary' : ''}`} onClick={()=>setView('table')} aria-pressed={view==='table'}>Table</button>
                <button className={`gg-btn ${view==='kanban' ? 'gg-btn-primary' : ''}`} onClick={()=>setView('kanban')} aria-pressed={view==='kanban'}>Kanban</button>
                <button className={`gg-btn ${view==='cards' ? 'gg-btn-primary' : ''}`} onClick={()=>setView('cards')} aria-pressed={view==='cards'}>Cards</button>
              </div>

              <button
                className="gg-btn"
                disabled={aiRefreshing || rows.length === 0}
                onClick={refreshAIForVisible}
                title="Run AI summary/next actions for all leads on this page"
              >
                {aiRefreshing
                  ? `AI Refresh… (${aiProgress.done}/${aiProgress.total})`
                  : "AI Refresh (Page)"}
              </button>

              <button className="gg-btn gg-btn-primary" onClick={openAddDrawer}>
                + Add Lead
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="gg-surface p-3 rounded-2xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search name, email, phone, company…"
              className="gg-input w-full lg:w-64"
              aria-label="Search leads"
            />

            <div className="flex gap-3">
              <select
                className="gg-input"
                value={filters.stage}
                onChange={(e) => { setFilters(f => ({ ...f, stage: e.target.value || "" })); setPage(1); }}
                aria-label="Stage"
              >
                <option value="">All Stages</option>
                {stages?.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>

              <select
                className="gg-input"
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

            <div className="flex items-center gap-2 lg:ml-auto">
              <button
                className="gg-btn gg-btn-ghost"
                onClick={() => { setFilters({ owner_id: "", stage: "", status: "" }); setQuery(""); setPage(1); }}
              >
                Reset
              </button>

              <details className="relative">
                <summary className="gg-btn cursor-pointer select-none">Columns</summary>
                <ul className="gg-panel absolute right-0 mt-2 w-56 p-2 z-[60]">
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

              // NEW: wire per-row AI refresh controls
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
      </div>
    </div>
  );
}
