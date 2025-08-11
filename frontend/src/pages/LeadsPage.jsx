// src/pages/LeadsPage.jsx
// …imports stay the same

export default function LeadsPage() {
  // …state & hooks remain the same

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="gg-header">
        <div className="gg-header-left">
          <h1 className="gg-title">Leads</h1>
          <span className="gg-subtle">({total})</span>
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
            total={total}
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
