import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Calendar, ChevronDown, RotateCw, Plus, Download, Columns3,
  Funnel, X, Table2, KanbanSquare, LayoutGrid
} from "lucide-react";

/** tiny helper */
const cx = (...xs) => xs.filter(Boolean).join(" ");

/**
 * World-class, responsive toolbar for the Leads list
 *
 * Props:
 *  - search, setSearch
 *  - dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD), onDateChange(from,to)
 *  - stage, status, stages[], statuses[], onStageChange, onStatusChange
 *  - view ('table'|'kanban'|'cards'), setView
 *  - onRefresh(), onAddLead(), onResetFilters(), onColumns()
 *  - onExport(type: 'csv' | 'xlsx' | 'pdf')
 *  - fyRange?: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }   // optional preset
 */
export default function LeadsToolbar({
  search = "",
  setSearch = () => {},
  dateFrom = "",
  dateTo = "",
  onDateChange = () => {},
  stage = "",
  status = "",
  stages = [],
  statuses = [],
  onStageChange = () => {},
  onStatusChange = () => {},
  view = "table",
  setView = () => {},
  onRefresh = () => {},
  onAddLead = () => {},
  onResetFilters = () => {},
  onColumns = () => {},
  onExport = () => {},
  fyRange = null,
}) {
  const [openFilters, setOpenFilters] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportBtnRef = useRef(null);
  const searchRef = useRef(null);

  // keyboard: "/" focuses search; "Esc" clears search
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearch]);

  const presets = useMemo(() => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);

    const last7 = new Date(today); last7.setDate(today.getDate() - 6);
    const last30 = new Date(today); last30.setDate(today.getDate() - 29);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const fy = fyRange
      ? fyRange
      : null;

    return [
      { key: "7d", label: "Last 7 days", from: iso(last7), to: iso(today) },
      { key: "30d", label: "Last 30 days", from: iso(last30), to: iso(today) },
      { key: "mtd", label: "This month", from: iso(monthStart), to: iso(today) },
      ...(fy ? [{ key: "fy", label: "This FY", from: fy.start, to: fy.end }] : []),
    ];
  }, [fyRange]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (stage) chips.push({ k: "stage", label: `Stage: ${stage}`, onClear: () => onStageChange("") });
    if (status) chips.push({ k: "status", label: `Status: ${status}`, onClear: () => onStatusChange("") });
    if (dateFrom && dateTo) chips.push({
      k: "daterange",
      label: `${dateFrom} → ${dateTo}`,
      onClear: () => onDateChange("", "")
    });
    if (search) chips.push({ k: "q", label: `“${search}”`, onClear: () => setSearch("") });
    return chips;
  }, [stage, status, dateFrom, dateTo, search, onStageChange, onStatusChange, onDateChange, setSearch]);

  return (
    <div className="w-full sticky top-0 z-10">
      {/* Top row: left filters (collapsed on mobile) + right actions */}
      <div className="gg-surface border border-base-300 rounded-xl px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
        {/* View switcher */}
        <div className="hidden lg:flex items-center bg-base-200 rounded-lg p-1">
          <button
            type="button"
            className={cx("btn btn-ghost btn-xs rounded-md", view === "table" && "btn-active")}
            title="Table"
            onClick={() => setView("table")}
          >
            <Table2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={cx("btn btn-ghost btn-xs rounded-md", view === "kanban" && "btn-active")}
            title="Kanban"
            onClick={() => setView("kanban")}
          >
            <KanbanSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={cx("btn btn-ghost btn-xs rounded-md", view === "cards" && "btn-active")}
            title="Cards"
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="flex-1">
          <label className="input input-bordered input-sm flex items-center gap-2 w-full">
            <Search className="w-4 h-4 opacity-70" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="text"
              placeholder="Search leads, company, contact…  (/ to focus)"
              className="grow"
            />
          </label>
        </div>

        {/* Date range (label-less, compact) */}
        <div className="hidden md:flex items-center gap-2">
          <div className="join">
            <label className="input input-bordered input-sm join-item flex items-center gap-2">
              <Calendar className="w-4 h-4 opacity-70" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateChange(e.target.value, dateTo)}
                className="min-w-[9.5rem]"
                placeholder="From"
              />
            </label>
            <label className="input input-bordered input-sm join-item flex items-center gap-2">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateChange(dateFrom, e.target.value)}
                className="min-w-[9.5rem]"
                placeholder="To"
              />
            </label>
            {/* Presets */}
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost btn-sm join-item gap-1">
                Presets <ChevronDown className="w-4 h-4" />
              </label>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-200 rounded-box z-[1] w-52 p-2 shadow"
              >
                {presets.map(p => (
                  <li key={p.key}>
                    <button
                      onClick={() => onDateChange(p.from, p.to)}
                    >
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Quick filter toggles (summary) */}
        <button
          type="button"
          className="btn btn-ghost btn-sm md:hidden"
          onClick={() => setOpenFilters((v) => !v)}
          title="Filters"
        >
          <Funnel className="w-4 h-4" />
          Filters
        </button>

        {/* Actions cluster */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Reset filters"
            onClick={onResetFilters}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Choose columns"
            onClick={onColumns}
          >
            <Columns3 className="w-4 h-4" />
            <span className="hidden xl:inline">Columns</span>
          </button>

          {/* Export menu */}
          <div className="dropdown dropdown-end">
            <button
              ref={exportBtnRef}
              onClick={() => setExportOpen((v) => !v)}
              className="btn btn-ghost btn-sm"
              title="Export"
              type="button"
            >
              <Download className="w-4 h-4" />
              <span className="hidden xl:inline">Export</span>
            </button>
            {exportOpen && (
              <ul className="dropdown-content menu bg-base-200 rounded-box z-20 w-44 p-2 shadow">
                <li><button onClick={() => { setExportOpen(false); onExport("csv"); }}>CSV</button></li>
                <li><button onClick={() => { setExportOpen(false); onExport("xlsx"); }}>Excel (.xlsx)</button></li>
                <li><button onClick={() => { setExportOpen(false); onExport("pdf"); }}>PDF</button></li>
              </ul>
            )}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Refresh"
            onClick={onRefresh}
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden xl:inline">Refresh</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onAddLead}
            title="Add Lead"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>
        </div>
      </div>

      {/* Secondary row: full filters + chips */}
      <div className="mt-2 space-y-2">
        {/* Expandable advanced filters on small screens */}
        <div className={cx("gg-surface border border-base-300 rounded-xl px-3 sm:px-4 py-3",
          openFilters ? "block" : "hidden md:block")}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Stage */}
            <select
              value={stage}
              onChange={(e) => onStageChange(e.target.value)}
              className="select select-bordered select-sm w-40"
            >
              <option value="">All Stages</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Status */}
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="select select-bordered select-sm w-40"
            >
              <option value="">All Status</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Duplicate compact date range for small screens */}
            <div className="flex md:hidden items-center gap-2">
              <label className="input input-bordered input-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 opacity-70" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateChange(e.target.value, dateTo)}
                />
              </label>
              <label className="input input-bordered input-sm flex items-center gap-2">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateChange(dateFrom, e.target.value)}
                />
              </label>
              <div className="dropdown">
                <label tabIndex={0} className="btn btn-ghost btn-sm gap-1">
                  Presets <ChevronDown className="w-4 h-4" />
                </label>
                <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box z-[1] w-52 p-2 shadow">
                  {presets.map(p => (
                    <li key={p.key}><button onClick={() => onDateChange(p.from, p.to)}>{p.label}</button></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map(chip => (
              <span key={chip.k} className="badge badge-outline gap-1">
                {chip.label}
                <button
                  type="button"
                  className="ml-1 hover:text-error"
                  onClick={chip.onClear}
                  title="Clear"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
