import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";
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

  const [view, setView] = useState("table"); // "table" | "kanban" | "cards"
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ owner_id: "", stage: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // use "count" instead of "total" to avoid scoping mixups
  const [count, setCount] = useState(0);

  const [rows, setRows] = useState([]);
  const [stages, setStages] = useState([]);
  const [columns, setColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("leads.columns"));
      return saved?.length ? saved : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });

  const [selected, setSelected] = useState(null); // lead id
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  // mounted guard to prevent blinking/flicker from stale updates
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // realtime
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

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listLeads(params);
      if (!mountedRef.current) return;
      const items = data.items || data.rows || [];
      setRows(items);
      setCount(Number(data.total ?? items.length ?? 0));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [api, params]);

  const fetchPipelines = useCallback(async () => {
    try {
      const data = await api.listPipelines();
      if (!mountedRef.current) return;
      setStages(data.stages || data || []);
    } catch {}
  }, [api]);

  useEffect(() => { fetchPipelines(); }, [fetchPipelines]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);

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
    if (newLead?.id) {
      setRows(prev => [newLead, ...prev]);
      setCount(c => c + 1);
    }
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
      {/* Header */}
      <div className="gg-header">
        <div className="gg-header-left">
          <h1 className="gg-title">Leads</h1>
          <span className="gg-subtle">({count})</span>
        </div>
        <div className="gg-header-right">
          <div className="btn-group">
            <button className={`btn btn-sm ${view==='table'?'btn-active':''}`} onClick={() => setView("table")}>Table</button>
            <button className={`btn btn-sm ${view==='kanban'?'btn-active':''}`} onClick={() => setView("kanban")}>Kanban</button>
            <button className={`btn btn-sm ${view==='cards'?'btn-active':''}`} onClick={() => setView("cards")}>Cards</button>
          </div>
          <button className="btn btn-primary gg-add-btn" onClick={() => setOpenAdd(true)}>
            + Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="gg-filters">
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
        <div className="ml-auto">
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
        {view === "table" && (
          <LeadsTable
            loading={loading}
            rows={rows}
            columns={visibleColumns}
            page={page}
            pageSize={pageSize}
            total={count}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onInlineUpdate={onInlineUpdate}
            onOpenLead={onOpenLead}
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
          <LeadsCards loading={loading} rows={rows} onOpenLead={onOpenLead} />
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
