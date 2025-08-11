export default function LeadsCards({ loading, rows = [], onOpenLead }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {loading && <div className="opacity-60 p-2">Loading…</div>}
      {!loading && rows.length === 0 && <div className="opacity-60 p-2">No leads found</div>}
      {rows.map(r => (
        <div key={r.id} className="panel hover:shadow">
          <div className="flex items-start justify-between">
            <button className="text-left font-semibold link" onClick={()=>onOpenLead(r.id)}>
              {r.name || "(untitled)"}
            </button>
            <span className="badge">AI {r.score ?? "-"}</span>
          </div>
          <div className="opacity-70">{r.company_name || "-"}</div>
          <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
            <span className="opacity-60">Stage</span><span>{r.stage || "-"}</span>
            <span className="opacity-60">Status</span><span>{r.status || "-"}</span>
            <span className="opacity-60">Owner</span><span>{r.owner_name || "-"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
