import { useMemo } from "react";

function KanbanSkeleton() {
  return (
    <div className="flex gap-4">
      {[1,2,3].map((i) => (
        <div key={i} className="flex-1 glass-panel rounded-2xl p-3">
          <div className="h-5 w-24 mb-3 rounded bg-base-300/60 animate-pulse" />
          {[1,2,3].map((k) => (
            <div key={k} className="h-20 mb-3 rounded-xl bg-base-300/40 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function LeadsKanban({
  loading,
  rows = [],
  stages = [],
  total = 0,
  onMoveStage,
  onOpenLead,
}) {
  const cols = useMemo(() => {
    const list = (stages?.length ? stages : Array.from(new Set(rows.map(r => r.stage).filter(Boolean)))).map(String);
    const grouped = Object.fromEntries(list.map(s => [s, []]));
    rows.forEach((r) => {
      const s = r.stage || list[0] || "new";
      (grouped[s] = grouped[s] || []).push(r);
    });
    return { order: list, grouped };
  }, [rows, stages]);

  if (loading) return <KanbanSkeleton />;

  const handleDrop = (e, stage) => {
    const id = e.dataTransfer.getData("text/plain");
    if (id) onMoveStage({ id, toStage: stage });
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {cols.order.map((stage) => (
        <div
          key={stage}
          className="glass-panel rounded-2xl p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, stage)}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold tracking-wide capitalize">{stage}</h3>
            <span className="badge badge-ghost">{cols.grouped[stage]?.length || 0}</span>
          </div>

          <div className="space-y-3 min-h-[120px]">
            {(cols.grouped[stage] || []).map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
                className="card bg-base-100/60 border border-base-300/50 rounded-xl shadow hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <div className="card-body p-3">
                  <div className="flex items-center justify-between">
                    <button className="font-medium link link-hover" onClick={() => onOpenLead(lead.id)}>
                      {lead.name || "(untitled)"}
                    </button>
                    <span className="badge badge-outline">{lead.status || "new"}</span>
                  </div>
                  <div className="text-xs opacity-70">{lead.company_name || "-"}</div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span>Owner: {lead.owner_name || "-"}</span>
                    <span>Score: {lead.score ?? "-"}</span>
                  </div>
                </div>
              </div>
            ))}

            {(!cols.grouped[stage] || cols.grouped[stage].length === 0) && (
              <div className="p-4 rounded-xl border border-dashed border-base-300/60 text-xs opacity-60 text-center">
                Drop here to move to <b className="capitalize">{stage}</b>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
