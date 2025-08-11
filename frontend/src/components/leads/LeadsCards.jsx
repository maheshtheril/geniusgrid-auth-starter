export default function LeadsCards({
  loading,
  rows = [],
  total = 0,
  onOpenLead,
}) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl glass-panel animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {rows.map((lead) => (
        <div
          key={lead.id}
          className="card glass-panel rounded-2xl shadow hover:shadow-xl transition-all hover:-translate-y-0.5"
        >
          <div className="card-body">
            <div className="flex items-center justify-between">
              <button className="card-title text-base link link-hover" onClick={() => onOpenLead(lead.id)}>
                {lead.name || "(untitled)"}
              </button>
              <span className="badge badge-outline capitalize">{lead.stage || "new"}</span>
            </div>

            <div className="text-sm opacity-80">{lead.company_name || "-"}</div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-base-200/60">
                <div className="opacity-60">Status</div>
                <div className="font-medium capitalize">{lead.status || "-"}</div>
              </div>
              <div className="p-2 rounded-lg bg-base-200/60">
                <div className="opacity-60">Owner</div>
                <div className="font-medium">{lead.owner_name || "-"}</div>
              </div>
              <div className="p-2 rounded-lg bg-base-200/60">
                <div className="opacity-60">AI Score</div>
                <div className="font-medium">{lead.score ?? "-"}</div>
              </div>
              <div className="p-2 rounded-lg bg-base-200/60">
                <div className="opacity-60">Created</div>
                <div className="font-medium truncate">{lead.created_at?.slice(0, 10) || "-"}</div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="col-span-full p-8 text-center opacity-60">No leads found</div>
      )}
    </div>
  );
}
