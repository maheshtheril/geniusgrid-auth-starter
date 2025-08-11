import { useMemo } from "react";

function SkeletonRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3">
          <div className="h-3 w-full animate-pulse rounded bg-base-300/60" />
        </td>
      ))}
    </tr>
  );
}

const badgeClasses = {
  new: "badge-info",
  qualified: "badge-primary",
  proposal: "badge-warning",
  negotiation: "badge-accent",
  won: "badge-success",
  lost: "badge-error",
};

export default function LeadsTable({
  loading,
  rows = [],
  columns = [],
  page,
  pageSize,
  total = 0,
  onPageChange,
  onPageSizeChange,
  onInlineUpdate,
  onOpenLead,
}) {
  const safeTotal = Number.isFinite(total) ? total : rows.length;
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(safeTotal / (pageSize || 25))),
    [safeTotal, pageSize]
  );

  const handleEdit = (id, key, value) => onInlineUpdate(id, { [key]: value });

  return (
    <div className="glass-panel rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-auto">
        <table className="table w-full">
          <thead className="sticky top-0 z-10 bg-base-200/70 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left uppercase tracking-wide text-xs">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300/40">
            {loading && (
              <>
                <SkeletonRow cols={columns.length} />
                <SkeletonRow cols={columns.length} />
                <SkeletonRow cols={columns.length} />
              </>
            )}

            {!loading && rows?.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center opacity-60">
                  No leads found
                </td>
              </tr>
            )}

            {!loading &&
              rows?.map((row) => (
                <tr key={row.id} className="hover:bg-base-200/40 transition-colors">
                  {columns.map((col) => {
                    const val = row[col.key];
                    const editable = ["status", "stage", "priority", "owner_name"].includes(col.key);

                    if (editable && col.key === "stage") {
                      return (
                        <td key={col.key} className="whitespace-nowrap">
                          <select
                            value={row.stage || ""}
                            onChange={(e) => handleEdit(row.id, "stage", e.target.value)}
                            className="select select-xs"
                          >
                            <option value="">—</option>
                            <option value="new">new</option>
                            <option value="qualified">qualified</option>
                            <option value="proposal">proposal</option>
                            <option value="negotiation">negotiation</option>
                            <option value="won">won</option>
                            <option value="lost">lost</option>
                          </select>
                        </td>
                      );
                    }

                    if (editable && col.key === "status") {
                      return (
                        <td key={col.key} className="whitespace-nowrap">
                          <select
                            value={row.status || ""}
                            onChange={(e) => handleEdit(row.id, "status", e.target.value)}
                            className="select select-xs"
                          >
                            <option value="new">new</option>
                            <option value="qualified">qualified</option>
                            <option value="won">won</option>
                            <option value="lost">lost</option>
                          </select>
                        </td>
                      );
                    }

                    if (editable) {
                      return (
                        <td key={col.key} className="whitespace-nowrap">
                          <input
                            className="input input-xs"
                            defaultValue={val ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== val) handleEdit(row.id, col.key, v);
                            }}
                          />
                        </td>
                      );
                    }

                    if (col.key === "name") {
                      return (
                        <td key={col.key} className="whitespace-nowrap">
                          <button className="link link-hover" onClick={() => onOpenLead(row.id)}>
                            {val || "(untitled)"}
                          </button>
                        </td>
                      );
                    }

                    if (col.key === "status" || col.key === "stage") {
                      const badge = badgeClasses[(val || "").toLowerCase()] || "badge-ghost";
                      return (
                        <td key={col.key} className="whitespace-nowrap">
                          <span className={`badge ${badge}`}>{val ?? "-"}</span>
                        </td>
                      );
                    }

                    if (col.key === "score") {
                      return (
                        <td key={col.key} className="min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <progress
                              className="progress progress-primary w-24"
                              value={Number(val ?? 0)}
                              max="100"
                            />
                            <span className="text-xs opacity-70">{val ?? "-"}</span>
                          </div>
                        </td>
                      );
                    }

                    return <td key={col.key}>{val ?? "-"}</td>;
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="flex items-center justify-between p-4 bg-base-200/60 backdrop-blur">
        <div className="opacity-60">Total: {safeTotal}</div>
        <div className="flex items-center gap-2">
          <select
            className="select select-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Prev
          </button>
          <span className="px-2">Page {page} / {pageCount}</span>
          <button
            className="btn btn-sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
