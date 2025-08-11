// HTML5 drag-and-drop (no external libs)
import { useMemo } from "react";

export default function LeadsKanban({ loading, rows = [], stages = [], onMoveStage, onOpenLead }) {
  const grouped = useMemo(() => {
    const g = Object.fromEntries((stages || []).map(s => [s, []]));
    for (const r of rows) {
      const key = r.stage && g[r.stage] ? r.stage : (stages?.[0] || "new");
      g[key].push(r);
    }
    return g;
  }, [rows, stages]);

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (e, stage) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    onMoveStage({ id, toStage: stage });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {(stages?.length ? stages : ["new","qualified","proposal","negotiation","won","lost"]).map(stage => (
        <div key={stage} className="panel min-h-[300px] flex flex-col"
             onDragOver={(e)=>e.preventDefault()}
             onDrop={(e)=>onDrop(e, stage)}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{stage}</h3>
            <span className="badge">{grouped[stage]?.length || 0}</span>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            {loading && <div className="opacity-60 p-2">Loading…</div>}
            {(grouped[stage] || []).map(card => (
              <div key={card.id}
                   draggable
                   onDragStart={(e)=>onDragStart(e, card.id)}
                   className="rounded border p-2 cursor-grab active:cursor-grabbing bg-base-100 hover:shadow">
                <div className="font-medium">
                  <button className="link" onClick={()=>onOpenLead(card.id)}>{card.name || "(untitled)"}</button>
                </div>
                <div className="text-sm opacity-70">{card.company_name || "-"}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="badge">AI {card.score ?? "-"}</span>
                  <span className="badge badge-outline">{card.status}</span>
                </div>
              </div>
            ))}
            {!loading && (grouped[stage]?.length === 0) && (
              <div className="opacity-50 text-sm">Drop leads here</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
