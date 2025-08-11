// 📁 src/components/leads/LeadsTable.jsx
import React, { useMemo } from "react";

/** World‑class table UI with clickable sort headers */
export default function LeadsTable({
  loading = false,
  rows = [],
  columns = [],
  page = 1,
  pageSize = 25,
  total = 0,
  sortKey,            // ← controlled by parent (LeadsPage)
  sortDir,            // ← "asc" | "desc"
  onSort,             // ← (key) => void
  onPageChange,
  onPageSizeChange,
  onInlineUpdate,
  onOpenLead,
}) {
  const visible = useMemo(() => columns.filter(c => c.visible), [columns]);
  const totalPages = Math.max(1, Math.ceil((total || rows.length || 0) / pageSize));

  if (loading) return <SkeletonTable columns={visible} />;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/60 to-gray-900/30 shadow-xl overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-900/70 backdrop-blur-md">
            <tr>
              {visible.map(col => {
                const active = sortKey === col.key;
                const arrow = active ? (sortDir === "asc" ? "▲" : "▼") : "";
                return (
                  <th
                    key={col.key}
                    onClick={() => onSort?.(col.key)}
                    title="Click to sort"
                    className={`text-left text-xs font-semibold uppercase tracking-wide px-4 py-3 border-b border-white/10 select-none
                                ${onSort ? "cursor-pointer hover:bg-white/5" : ""}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-gray-300">{col.label}</span>
                      {arrow && <span className="text-[10px] text-gray-400">{arrow}</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {rows.map((r, idx) => (
              <tr
                key={r.id || idx}
                onClick={() => onOpenLead && onOpenLead(r.id)}
                className="cursor-pointer hover:bg-white/5"
              >
                {visible.map(col => (
                  <td key={col.key} className="px-4 py-3 text-sm text-gray-200">
                    {renderCell(col.key, r, onInlineUpdate)}
                  </td>
                ))}
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={visible.length} className="px-4 py-10 text-center text-gray-400">
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-gray-900/40">
        <div className="text-xs text-gray-400">
          Total: <span className="text-gray-200">{total || rows.length}</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="select select-sm bg-white/5 text-gray-200"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s}/page</option>)}
          </select>

          <div className="text-xs text-gray-400">Page {page} / {totalPages}</div>

          <div className="btn-group">
            <button
              className="btn btn-sm"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              Prev
            </button>
            <button
              className="btn btn-sm"
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
          <div className="font-semibold text-white hover:underline">{r.name || "—"}</div>
        </div>
      );

    case "company_name":
      return <span className="text-gray-300">{r.company_name || r.company?.name || "—"}</span>;

    case "status":
      return <Chip text={r.status || "—"} tone="blue" />;

    case "stage":
      return <StageChip stage={r.stage} />;

    case "owner_name":
      return (
        <div className="flex items-center gap-2">
          <Avatar text={r.owner_name} size={8} />
          <span className="text-gray-300">{r.owner_name || "Unassigned"}</span>
        </div>
      );

    case "score":
    case "ai_score":
      return <ScoreBar value={Number(r.score ?? r.ai_score ?? 0)} />;

    case "priority":
      return <Chip text={r.priority || "—"} tone="amber" />;

    case "created_at":
      return (
        <span className="text-gray-300">
          {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
        </span>
      );

    default:
      return <span className="text-gray-300">{String(r[key] ?? "—")}</span>;
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
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone] || tones.gray}`}>
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
  const initials = (text || "")
    .split(" ")
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "–";
  return (
    <div
      className={`flex items-center justify-center h-${size} w-${size} rounded-full 
                  bg-white/10 text-[10px] text-gray-200 border border-white/10`}
    >
      {initials}
    </div>
  );
}

function ScoreBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-40">
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            background:
              "linear-gradient(90deg, #22c55e, #60a5fa 50%, #a855f7 100%)",
          }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-400">{v}%</div>
    </div>
  );
}

/* ---------- Loading skeleton ---------- */

function SkeletonTable({ columns }) {
  const cols = columns?.length || 6;
  const rows = 6;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/60 to-gray-900/30 shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-900/70 backdrop-blur-md">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 border-b border-white/10">
                  <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((__, c) => (
                  <td key={c} className="px-4 py-3">
                    <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-white/10 bg-gray-900/40" />
    </div>
  );
}
