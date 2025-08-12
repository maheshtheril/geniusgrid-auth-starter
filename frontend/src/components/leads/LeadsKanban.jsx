// 📁 src/components/leads/LeadsKanban.jsx
import { useMemo } from "react";

function KanbanSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl gg-panel p-3">
          <div className="mb-3 h-5 w-24 rounded bg-[color:var(--border)]/30 animate-pulse" />
          {[1, 2, 3].map((k) => (
            <div key={k} className="mb-3 h-20 rounded-xl bg-[color:var(--border)]/20 animate-pulse" />
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
    const list =
      (stages?.length
        ? stages
        : Array.from(new Set(rows.map((r) => r.stage).filter(Boolean))))?.map(String) || [];
    const grouped = Object.fromEntries(list.map((s) => [s, []]));
    rows.forEach((r) => {
      const s = r.stage || list[0] || "new";
      (grouped[s] = grouped[s] || []).push(r);
    });
    return { order: list, grouped };
  }, [rows, stages]);

  if (loading) return <KanbanSkeleton />;

  const handleDrop = (e, stage) => {
    const id = e.dataTransfer.getData("text/plain");
    if (id) onMoveStage?.({ id, toStage: stage });
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cols.order.map((stage) => (
        <div
          key={stage}
          className="rounded-2xl gg-panel p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, stage)}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="capitalize font-semibold tracking-wide text-[color:var(--text)]">
              {stage}
            </h3>
            <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
              {cols.grouped[stage]?.length || 0}
            </span>
          </div>

          <div className="min-h-[120px] space-y-3">
            {(cols.grouped[stage] || []).map((lead) => (
              <div
                key={lead.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(lead.id))}
                className="rounded-xl gg-surface border border-[color:var(--border)] shadow transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <button
                      className="font-medium text-[color:var(--text)] hover:underline"
                      onClick={() => onOpenLead?.(lead.id)}
                    >
                      {lead.name || "(untitled)"}
                    </button>
                    <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--muted)]">
                      {lead.status || "new"}
                    </span>
                  </div>

                  <div className="text-xs text-[color:var(--muted)]">{lead.company_name || "-"}</div>

                  <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                    <span>Owner: {lead.owner_name || "-"}</span>
                    <span>Score: {lead.score ?? "-"}</span>
                  </div>
                </div>
              </div>
            ))}

            {(!cols.grouped[stage] || cols.grouped[stage].length === 0) && (
              <div className="rounded-xl border border-dashed border-[color:var(--border)]/70 p-4 text-center text-xs text-[color:var(--muted)]">
                Drop here to move to <b className="capitalize text-[color:var(--text)]">{stage}</b>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
