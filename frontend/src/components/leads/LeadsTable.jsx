// 📁 src/components/leads/LeadsTable.jsx
import React, { useMemo } from "react";

/** World-class table UI with clickable sort headers (theme-aware) */
export default function LeadsTable({
  loading = false,
  rows = [],
  columns = [],
  page = 1,
  pageSize = 25,
  total = 0,
  sortKey,            // controlled by parent (LeadsPage)
  sortDir,            // "asc" | "desc"
  onSort,             // (key) => void
  onPageChange,
  onPageSizeChange,
  onInlineUpdate,
  onOpenLead,

  // NEW (optional): per-row AI refresh
  onAiRefreshRow,           // (id) => Promise<void>
  aiRefreshingIds,          // Set<string> | string[]
}) {
  const visible = useMemo(() => columns.filter((c) => c.visible), [columns]);
  const totalPages = Math.max(1, Math.ceil((total || rows.length || 0) / pageSize));

  // normalize busy ids to a Set for O(1) lookup
  const busySet = useMemo(() => {
    if (!aiRefreshingIds) return new Set();
    return aiRefreshingIds instanceof Set ? aiRefreshingIds : new Set(aiRefreshingIds);
  }, [aiRefreshingIds]);

  if (loading) return <SkeletonTable columns={visible} showActions={!!onAiRefreshRow} />;

  return (
    <div className="rounded-2xl gg-panel shadow-xl overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-[color:var(--panel)]/90 backdrop-blur">
            <tr className="border-b border-[color:var(--border)]">
              {visible.map((col) => {
                const active = sortKey === col.key;
                const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
                return (
                  <th
                    key={col.key}
                    onClick={() => onSort?.(col.key)}
                    title={onSort ? "Click to sort" : undefined}
                    className={`select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide
                                ${onSort ? "cursor-pointer hover:bg-[color:var(--border)]/20" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[color:var(--muted)]">{col.label}</span>
                      {arrow && <span className="text-[10px] text-[color:var(--muted)]">{arrow}</span>}
                    </div>
                  </th>
                );
              })}
              {onAiRefreshRow && (
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  AI
                </th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-[color:var(--border)]/60">
            {rows.map((r, idx) => (
              <tr
                key={r.id || idx}
                onClick={() => onOpenLead && onOpenLead(r.id)}
                className="cursor-pointer hover:bg-[color:var(--border)]/20"
              >
                {visible.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-[color:var(--text)]">
                    {renderCell(col.key, r, onInlineUpdate)}
                  </td>
                ))}

                {onAiRefreshRow && (
                  <td className="px-3 py-3 text-right">
                    <AiRefreshButton
                      busy={busySet.has(r.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onAiRefreshRow?.(r.id);
                      }}
                    />
                  </td>
                )}
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={visible.length + (onAiRefreshRow ? 1 : 0)}
                  className="px-4 py-10 text-center text-[color:var(--muted)]"
                >
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="flex items-center justify-between border-t border-[color:var(--border)] bg-[color:var(--panel)]/70 px-4 py-3">
        <div className="text-xs text-[color:var(--muted)]">
          Total: <span className="text-[color:var(--text)]">{total || rows.length}</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="gg-input px-2 py-1.5 rounded-md text-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[10, 25, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s}/page
              </option>
            ))}
          </select>

          <div className="text-xs text-[color:var(--muted)]">
            Page {page} / {totalPages}
          </div>

          <div className="inline-flex gap-2">
            <button
              className="gg-btn gg-btn-ghost border border-[color:var(--border)] text-sm disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              Prev
            </button>
            <button
              className="gg-btn gg-btn-ghost border border-[color:var(--border)] text-sm disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Cell renderers ---------- */

function renderCell(key, r, onInlineUpdate) {
  switch (key) {
    case "name":
      return (
        <div className="flex items-center gap-2">
          <Avatar text={r.name} />
          <div className="font-semibold text-[color:var(--text)] hover:underline">
            {r.name || "—"}
          </div>
        </div>
      );

    case "company_name":
      return <span className="text-[color:var(--muted)]">{r.company_name || r.company?.name || "—"}</span>;

    case "status":
      return <Chip text={r.status || "—"} tone="blue" />;

    case "stage":
      return <StageChip stage={r.stage} />;

    case "owner_name":
      return (
        <div className="flex items-center gap-2">
          <Avatar text={r.owner_name} size={8} />
          <span className="text-[color:var(--muted)]">{r.owner_name || "Unassigned"}</span>
        </div>
      );

    case "score":
    case "ai_score":
      return <ScoreBar value={Number(r.score ?? r.ai_score ?? 0)} />;

    case "priority":
      return <Chip text={r.priority || "—"} tone="amber" />;

    case "created_at":
      return (
        <span className="text-[color:var(--muted)]">
          {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
        </span>
      );

    default:
      return <span className="text-[color:var(--muted)]">{String(r[key] ?? "—")}</span>;
  }
}

/* ---------- UI atoms ---------- */

function Chip({ text, tone = "gray" }) {
  const tones = {
    blue: "bg-blue-500/20 text-blue-300",
    green: "bg-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/20 text-amber-300",
    rose: "bg-rose-500/20 text-rose-300",
    gray: "bg-gray-500/20 text-gray-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.gray}`}>
      {text}
    </span>
  );
}

function StageChip({ stage }) {
  const s = (stage || "").toLowerCase();
  const tone =
    s === "qualified" ? "green" :
    s === "proposal"  ? "blue"  :
    s === "won"       ? "green" :
    s === "lost"      ? "rose"  :
    "gray";
  return <Chip text={stage || "—"} tone={tone} />;
}

function Avatar({ text = "", size = 9 }) {
  // Tailwind can't compile dynamic h-${size}/w-${size} classes; map sizes explicitly
  const sizeMap = { 7: "h-7 w-7", 8: "h-8 w-8", 9: "h-9 w-9", 10: "h-10 w-10" };
  const hw = sizeMap[size] || sizeMap[9];
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
    >
      {initials}
    </div>
  );
}

function ScoreBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-40">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--border)]/30">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            background:
              "linear-gradient(90deg, #22c55e 0%, #60a5fa 50%, #a855f7 100%)",
          }}
        />
      </div>
      <div className="mt-1 text-xs text-[color:var(--muted)]">{v}%</div>
    </div>
  );
}

function AiRefreshButton({ busy, onClick }) {
  return (
    <button
      className={`gg-btn gg-btn-ghost text-xs px-2 py-1 ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
      disabled={busy}
      onClick={onClick}
      title="AI refresh this lead"
      aria-busy={busy}
    >
      {busy ? (
        <span className="inline-flex items-center gap-1">
          <Spinner /> <span>AI…</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">↻ AI</span>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block align-[-1px]"
      style={{
        width: 12, height: 12, borderRadius: "50%",
        border: "2px solid var(--border)",
        borderTopColor: "var(--text)",
        animation: "gg-spin 0.6s linear infinite"
      }}
    />
  );
}

/* ---------- Loading skeleton ---------- */

function SkeletonTable({ columns, showActions }) {
  const cols = (columns?.length || 6) + (showActions ? 1 : 0);
  const rows = 6;
  return (
    <div className="rounded-2xl gg-panel shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-[color:var(--panel)]/90 backdrop-blur">
            <tr className="border-b border-[color:var(--border)]">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--border)]/30" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]/60">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((__, c) => (
                  <td key={c} className="px-4 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-[color:var(--border)]/25" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[color:var(--border)] bg-[color:var(--panel)]/70 px-4 py-3" />
      <style>{`
        @keyframes gg-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
