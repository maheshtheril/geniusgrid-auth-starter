// 📁 src/components/leads/LeadsKanban.jsx
import { useMemo, useState } from "react";

/* Props unchanged: loading, rows, stages, total, onMoveStage({id,toStage}), onOpenLead(id) */

function KanbanSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl gg-panel p-4">
          <div className="mb-4 h-5 w-28 rounded bg-[color:var(--border)]/30 animate-pulse" />
          {[1, 2, 3].map((k) => (
            <div key={k} className="mb-3 h-24 rounded-xl bg-[color:var(--border)]/20 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ✅ Stronger, unique tints for all common stages
const stageStyles = (stage) => {
  const s = String(stage || "").toLowerCase();

  if (s.includes("won"))
    return {
      ring: "ring-emerald-400/50",
      chipBg: "bg-emerald-500/15",
      chipText: "text-emerald-300", // bright in dark; light gets overridden by your light CSS
      accent: "from-emerald-500/12 to-emerald-500/0",
      topBar: "bg-emerald-400/60",
    };

  if (s.includes("lost"))
    return {
      ring: "ring-rose-400/50",
      chipBg: "bg-rose-500/15",
      chipText: "text-rose-300",
      accent: "from-rose-500/12 to-rose-500/0",
      topBar: "bg-rose-400/60",
    };

  if (s.includes("proposal") || s.includes("negoti"))
    return {
      ring: "ring-blue-400/50",
      chipBg: "bg-blue-500/15",
      chipText: "text-blue-300",
      accent: "from-blue-500/12 to-blue-500/0",
      topBar: "bg-blue-400/60",
    };

  if (s.includes("qualif"))
    return {
      ring: "ring-sky-400/50",
      chipBg: "bg-sky-500/15",
      chipText: "text-sky-300",
      accent: "from-sky-500/12 to-sky-500/0",
      topBar: "bg-sky-400/60",
    };

  // 🔥 NEW → give the “plain” ones proper color
  if (s.includes("prospect"))
    return {
      ring: "ring-violet-400/50",
      chipBg: "bg-violet-500/15",
      chipText: "text-violet-300",
      accent: "from-violet-500/12 to-violet-500/0",
      topBar: "bg-violet-400/60",
    };

  if (s.includes("contact"))
    return {
      ring: "ring-cyan-400/50",
      chipBg: "bg-cyan-500/15",
      chipText: "text-cyan-300",
      accent: "from-cyan-500/12 to-cyan-500/0",
      topBar: "bg-cyan-400/60",
    };

  if (s.includes("new"))
    return {
      ring: "ring-indigo-400/50",
      chipBg: "bg-indigo-500/15",
      chipText: "text-indigo-300",
      accent: "from-indigo-500/12 to-indigo-500/0",
      topBar: "bg-indigo-400/60",
    };

  // default
  return {
    ring: "ring-slate-400/40",
    chipBg: "bg-slate-500/10",
    chipText: "text-slate-300",
    accent: "from-slate-500/10 to-slate-500/0",
    topBar: "bg-slate-400/50",
  };
};

export default function LeadsKanban({
  loading,
  rows = [],
  stages = [],
  total = 0,
  onMoveStage,
  onOpenLead,
}) {
  const [dragId, setDragId] = useState(null);

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
    setDragId(null);
  };

  return (
    <div className="gg-kanban grid gap-5 md:grid-cols-3">
      {cols.order.map((stage) => {
        const S = stageStyles(stage);
        return (
          <div
            key={stage}
            className={`group rounded-2xl gg-panel p-3 ring-0 transition-shadow hover:shadow-2xl/40 relative overflow-hidden`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* subtle stage tint */}
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${S.accent}`} />

            {/* header */}
            <div className="relative mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-1.5 w-8 rounded-full ${S.topBar}`} />
                <h3 className="capitalize font-semibold tracking-wide text-[color:var(--text)]">
                  {stage}
                </h3>
              </div>
              <span className="rounded-full bg-[color:var(--panel)] border border-[color:var(--border)] px-2 py-0.5 text-xs text-[color:var(--muted)] shadow-sm">
                {cols.grouped[stage]?.length || 0}
              </span>
            </div>

            {/* drop hint */}
            {dragId && (
              <div className="mb-2 rounded-lg border border-dashed border-[color:var(--border)]/70 px-3 py-2 text-center text-[10px] text-[color:var(--muted)]">
                Drop to move into <b className="capitalize text-[color:var(--text)]">{stage}</b>
              </div>
            )}

            {/* cards */}
            <div className="min-h-[140px] space-y-3">
              {(cols.grouped[stage] || []).map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onOpenLead={onOpenLead}
                  setDragId={setDragId}
                  styleSet={S}
                />
              ))}

              {(!cols.grouped[stage] || cols.grouped[stage].length === 0) && (
                <div className="rounded-xl border border-dashed border-[color:var(--border)]/70 p-4 text-center text-xs text-[color:var(--muted)]">
                  Drop here to move to <b className="capitalize text-[color:var(--text)]">{stage}</b>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Scoped dark-theme readability for tiny text (no global side effects) */}
      <style>{`
        :root[data-theme="dark"] .gg-kanban [data-micro],
        html.theme-dark .gg-kanban [data-micro],
        body.theme-dark .gg-kanban [data-micro] {
          color: #cbd5e1 !important; /* slate-300 */
          opacity: 0.95 !important;
        }
      `}</style>
    </div>
  );
}

function LeadCard({ lead, onOpenLead, setDragId, styleSet }) {
  const { ring, chipBg, chipText } = styleSet;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(lead.id));
        setDragId(lead.id);
      }}
      onDragEnd={() => setDragId(null)}
      className={`rounded-xl gg-surface border border-[color:var(--border)] shadow transition-all hover:-translate-y-0.5 hover:shadow-xl ${ring}`}
    >
      <div className="p-3">
        {/* title row */}
        <div className="flex items-center justify-between gap-2">
          <button
            className="font-medium text-[color:var(--text)] hover:underline text-left line-clamp-1"
            onClick={() => onOpenLead?.(lead.id)}
            title={lead.name || "(untitled)"}
          >
            {lead.name || "(untitled)"}
          </button>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${chipBg} ${chipText} border border-[color:var(--border)]/40`}
            title={`Status: ${lead.status || "new"}`}
          >
            {lead.status || "new"}
          </span>
        </div>

        {/* subline */}
        <div className="mt-1 flex items-center justify-between text-[11px] text-[color:var(--muted)]" data-micro>
          <div className="inline-flex items-center gap-1 min-w-0">
            <Dot />
            <span className="truncate" title={lead.company_name || "-"}>{lead.company_name || "-"}</span>
          </div>
          <div className="inline-flex items-center gap-1">
            <Shield />
            <span title="Score">{lead.score ?? "-"}</span>
          </div>
        </div>

        {/* footer chips */}
        <div className="mt-2 flex items-center justify-between" data-micro>
          <div className="inline-flex items-center gap-2 text-[11px]">
            <Avatar text={lead.owner_name} size={7} />
            <span className="truncate max-w-[10rem]" title={lead.owner_name || "-"}>{lead.owner_name || "-"}</span>
          </div>
          {lead.priority && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${chipBg} ${chipText} border border-[color:var(--border)]/40`}
              title={`Priority: ${lead.priority}`}
            >
              {lead.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ text = "", size = 8 }) {
  const sizeMap = { 7: "h-7 w-7", 8: "h-8 w-8", 9: "h-9 w-9", 10: "h-10 w-10" };
  const hw = sizeMap[size] || sizeMap[8];
  const initials =
    (text || "")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "–";
  return (
    <div
      className={`flex items-center justify-center ${hw} rounded-full border border-[color:var(--border)] bg-[color:var(--border)]/20 text-[10px] text-[color:var(--text)]`}
      aria-label={`Avatar ${initials}`}
    >
      {initials}
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--muted)]/60" />;
}

function Shield() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="opacity-70">
      <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 12.5l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
