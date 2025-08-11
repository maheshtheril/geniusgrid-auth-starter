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

  // View, filters, pagination
  const [view, setView] = useState("table");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ owner_id: "", stage: "", status: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [count, setCount] = useState(0);

  // Sorting
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  // Data + UI state
  const [rows, setRows] = useState([]);
  const [stages, setStages] = useState([]);
  const [columns, setColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("leads.columns"));
      return saved?.length ? saved : DEFAULT_COLUMNS;
    } catch {
      return DEFAULT_COLUMNS;
    }
  });
  const [selected, setSelected] = useState(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mounted guard
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Realtime updates
  useRealtime({
    onLeadEvent: (evt) => {
      if (!evt?.lead) return;
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === evt.lead.id);
        if (idx === -1) return [evt.lead, ...prev];
        const next = prev.slice();
        next[idx] = { ...prev[idx], ...evt.lead };
        return next;
      });
    },
  });

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns]
  );

  // World-class params object
  const params = useMemo(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const premium = {
      search_query: query?.trim() || undefined,
      filter_stage: filters.stage || undefined,
      filter_status: filters.status || undefined,
      filter_owner_id: filters.owner_id || undefined,
      page_number: page,
      page_size: pageSize,
      sort_by: sortKey || undefined,
      sort_direction: sortDir || undefined,
      view_type: view,
      visible_columns: visibleColumns.map((c) => c.key),
      timezone,
      include_ai_insights: true,
      include_related_entities: ["company", "owner"],
    };

    const legacy = {
      q: query || undefined,
      stage: filters.stage || undefined,
      status: filters.status || undefined,
      owner_id: filters.owner_id || undefined,
      page,
      pageSize,
      sort: sortKey || undefined,
      dir: sortDir || undefined,
      view,
    };

    const merged = { ...legacy, ...premium };
    return Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined)
    );
  }, [query, filters, page, pageSize, sortKey, sortDir, view, visibleColumns]);

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

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Client-side sorting
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
    arr.sort((a, b) => {
      const va = normalize(a[sortKey]);
      const vb = normalize(b[sortKey]);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  // Actions
  const onInlineUpdate = async (id, patch) => {
    await api.updateLead(id, patch);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const onMoveStage = async ({ id, toStage }) => {
    await api.updateLead(id, { stage: toStage });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stage: toStage } : r)));
  };

  const onOpenLead = (id) => {
    setSelected(id);
    setOpenDrawer(true);
  };

  const onAddSuccess = (newLead) => {
    setOpenAdd(false);
    if (newLead?.id) {
      setRows((prev) => [newLead, ...prev]);
      setCount((c) => c + 1);
    }
  };

  const toggleColumn = (key) => {
    setColumns((prev) => {
      const next = prev.map((c) =>
        c.key === key ? { ...c, visible: !c.visible } : c
      );
      localStorage.setItem("leads.columns", JSON.stringify(next));
      return next;
    });
  };

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0D10] text-gray-200">
      <div className="p-4 flex flex-col gap-4">

        {/* Header — Tailwind only, no plugins */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/80 border border-white/10 shadow-xl">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">Leads</h1>
            <span className="text-sm text-gray-400">({count})</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
              <button
                className={`px-3 py-1.5 text-sm ${view==='table' ? 'bg-indigo-600 text-white' : 'bg-transparent text-gray-300 hover:bg-white/10'}`}
                onClick={() => setView('table')}
              >Table</button>
              <button
                className={`px-3 py-1.5 text-sm ${view==='kanban' ? 'bg-indigo-600 text-white' : 'bg-transparent text-gray-300 hover:bg-white/10'}`}
                onClick={() => setView('kanban')}
              >Kanban</button>
              <button
                className={`px-3 py-1.5 text-sm ${view==='cards' ? 'bg-indigo-600 text-white' : 'bg-transparent text-gray-300 hover:bg-white/10'}`}
                onClick={() => setView('cards')}
              >Cards</button>
            </div>

            <button
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
              onClick={() => setOpenAdd(true)}
            >
              + Add Lead
            </button>
          </div>
        </div>

        {/* Filters — Tailwind only */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-900/70 border border-white/10">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search name, email, phone, company…"
            className="px-3 py-2 rounded-md bg-neutral-800 text-gray-200 placeholder-gray-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 w-64"
          />

          <select
            className="px-3 py-2 rounded-md bg-neutral-800 text-gray-200 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            value={filters.stage}
            onChange={(e) => { setFilters(f => ({ ...f, stage: e.target.value || "" })); setPage(1); }}
          >
            <option value="">All Stages</option>
            {stages?.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 rounded-md bg-neutral-800 text-gray-200 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            value={filters.status}
            onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value || "" })); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          <button
            className="ml-auto px-3 py-2 rounded-md bg-transparent text-gray-300 hover:bg-white/10 border border-white/10"
            onClick={() => { setFilters({ owner_id: "", stage: "", status: "" }); setQuery(""); setPage(1); }}
          >
            Reset
          </button>

          <div className="relative">
            <details className="group">
              <summary className="px-3 py-2 rounded-md bg-transparent text-gray-300 hover:bg-white/10 border border-white/10 cursor-pointer select-none">
                Columns
              </summary>
              <ul className="absolute right-0 mt-2 w-56 rounded-2xl bg-neutral-900/95 border border-white/10 p-2 shadow-xl z-20">
                {columns.map((c) => (
                  <li key={c.key} className="px-2 py-1.5">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={c.visible}
                        onChange={() => toggleColumn(c.key)}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-gray-200">{c.label}</span>
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
            onClose={() => setOpenAdd(false)}
            onSuccess={onAddSuccess}
          />
        )}
      </div>
    </div>
  );
}
