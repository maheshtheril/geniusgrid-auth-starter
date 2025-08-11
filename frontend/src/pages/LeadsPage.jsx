// src/pages/LeadsPage.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";
import { isCanceled } from "@/lib/api";
import { useRealtime } from "@/hooks/useRealtime";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadsKanban from "@/components/leads/LeadsKanban";
import LeadsCards from "@/components/leads/LeadsCards";
import LeadDrawer from "@/components/leads/LeadDrawer";
import AddLeadDrawer from "@/components/leads/AddLeadDrawer";

const DEFAULT_COLUMNS = [
  { key: "name", label: "Lead", visible: true },
  { key: "company_name", label: "Company", visible: true },
  { key: "status", label: "Status", visible: true },
  { key: "stage", label: "Stage", visible: true },
  { key: "owner_name", label: "Owner", visible: true },
  { key: "score", label: "AI Score", visible: true },
  { key: "priority", label: "Priority", visible: false },
  { key: "created_at", label: "Created", visible: true },
];

export default function LeadsPage() {
  const api = useLeadsApi();

  const [view, setView] = useState("table");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ owner_id: "", stage: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState([]);
  const [stages, setStages] = useState([]);

  const [columns, setColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("leads.columns"));
      return saved?.length ? saved : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });

  const [selected, setSelected] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);

  // split the spinner: initial blocking vs soft refresh
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // show a gentle banner only when server really rate-limits
  const [backingOff, setBackingOff] = useState(false);

  // ---- debounce helper (for search/filters) ----
  const debounceRef = useRef();
  const debounced = (fn, ms = 350) => (...args) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fn(...args), ms);
  };

  // ---- guard: ignore stale responses & StrictMode double-run ----
  const reqSeq = useRef(0);
  const mountedOnce = useRef(false);
  const hasLoadedOnce = useRef(false);

  // realtime updates (lightweight)
  useRealtime({
    onLeadEvent: (evt) => {
      if (evt?.lead) {
        setRows(prev => {
          const idx = prev.findIndex(r => r.id === evt.lead.id);
          if (idx === -1) return [evt.lead, ...prev];
          const changed =
            JSON.stringify(prev[idx]) !== JSON.stringify({ ...prev[idx], ...evt.lead });
        if (!changed) return prev;
          const next = prev.slice();
          next[idx] = { ...prev[idx], ...evt.lead };
          return next;
        });
      }
    }
  });

  const visibleColumns = useMemo(
    () => columns.filter(c => c.visible),
    [columns]
  );

  const params = useMemo(() => ({
    q: query || undefined,
    ...filters,
    page,
    pageSize
  }), [query, filters, page, pageSize]);

  // ---- data loaders with guards ----
  const fetchLeads = useCallback(async () => {
    const seq = ++reqSeq.current;
    const firstLoad = !hasLoadedOnce.current && rows.length === 0;

    if (firstLoad) setInitialLoading(true);
    else setRefreshing(true);

    try {
      const data = await api.listLeads(params);
      if (reqSeq.current !== seq) return; // stale response, ignore

      setRows(data.items || data.rows || []);
      setTotal(data.total || 0);
      setBackingOff(false);
      hasLoadedOnce.current = true;
    } catch (e) {
      if (!isCanceled(e)) {
        if (e?.response?.status === 429) setBackingOff(true);
        // else: optional toast/log
      }
    } finally {
      if (reqSeq.current === seq) {
        if (firstLoad) setInitialLoading(false);
        else setRefreshing(false);
      }
    }
  }, [api, params, rows.length]);

  const fetchPipelines = useCallback(async () => {
    try {
      const data = await api.listPipelines();
      setStages(data || []);
    } catch (e) {
      if (!isCanceled(e)) {
        setStages(s => s?.length ? s : ["New", "Qualified", "Proposal", "Won", "Lost"]);
      }
    }
  }, [api]);

  // ---- run once on mount (even in StrictMode) ----
  useEffect(() => {
    if (mountedOnce.current) return;
    mountedOnce.current = true;
    fetchPipelines();
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- re-fetch when params change (debounced) ----
  useEffect(() => {
    const run = debounced(fetchLeads, 350);
    run();
    return () => clearTimeout(debounceRef.current);
  }, [fetchLeads]);

  // ---- actions ----
  const onInlineUpdate = async (id, patch) => {
    await api.updateLead(id, patch);
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const onMoveStage = async ({ id, toStage }) => {
    await api.updateLead(id, { stage: toStage });
    setRows(prev => prev.map(r => (r.id === id ? { ...r, stage: toStage } : r)));
  };

  const onOpenLead = (id) => {
    setSelected(id);
    setOpenDrawer(true);
  };

  const onAddSuccess = (newLead) => {
    setOpenAdd(false);
    if (newLead?.id) setRows(prev => [newLead, ...prev]);
  };

  const toggleColumn = (key) => {
    setColumns(prev => {
      const next = prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
      localStorage.setItem("leads.columns", JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Backoff hint */}
      {backingOff && (
        <div className="alert alert-warning">
          We’re rate-limited briefly. Retrying in the background.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Leads</h1>
          <span className="opacity-60">({total})</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={`btn ${view==='table'?'btn-primary':'btn-ghost'}`} onClick={() => setView("table")}>Table</button>
          <button className={`btn ${view==='kanban'?'btn-primary':'btn-ghost'}`} onClick={() => setView("kanban")}>Kanban</button>
          <button className={`btn ${view==='cards'?'btn-primary':'btn-ghost'}`} onClick={() => setView("cards")}>Cards</button>
          <button className="btn btn-primary" onClick={() => setOpenAdd(true)}>Add Lead</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search name, email, phone, company…"
          className="input w-64"
        />
        <select className="select" value={filters.stage} onChange={e => { setFilters(f => ({ ...f, stage: e.target.value || "" })); setPage(1); }}>
          <option value="">All Stages</option>
          {stages?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value || "" })); setPage(1); }}>
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <button className="btn btn-ghost" onClick={() => { setFilters({ owner_id: "", stage: "", status: "" }); setQuery(""); setPage(1); }}>
          Reset
        </button>
        {/* Column chooser */}
        <div className="ml-auto flex items-center gap-2">
          <details className="dropdown">
            <summary className="btn btn-ghost">Columns</summary>
            <ul className="menu dropdown-content p-2 shadow bg-base-100 rounded-box w-56">
              {columns.map(c => (
                <li key={c.key}>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={c.visible} onChange={() => toggleColumn(c.key)} />
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {initialLoading ? (
          <div className="flex items-center justify-center h-64 opacity-80">Loading…</div>
        ) : (
          <>
            {view === "table" && (
              <LeadsTable
                loading={refreshing}
                rows={rows}
                columns={visibleColumns}
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onInlineUpdate={onInlineUpdate}
                onOpenLead={onOpenLead}
              />
            )}
            {view === "kanban" && (
              <LeadsKanban
                loading={refreshing}
                rows={rows}
                stages={stages}
                onMoveStage={onMoveStage}
                onOpenLead={onOpenLead}
              />
            )}
            {view === "cards" && (
              <LeadsCards
                loading={refreshing}
                rows={rows}
                onOpenLead={onOpenLead}
              />
            )}
          </>
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
          onClose={() => setOpenAdd(false)}
          onSuccess={onAddSuccess}
        />
      )}
    </div>
  );
}
