import { useMemo } from "react";

export default function LeadsTable({
  loading, rows, columns, page, pageSize, total,
  onPageChange, onPageSizeChange, onInlineUpdate, onOpenLead
}) {
  const pageCount = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize]);

  const handleEdit = (id, key, value) => onInlineUpdate(id, { [key]: value });

  return (
    <div className="panel">
      <div className="overflow-auto">
        <table className="table w-full">
          <thead>
            <tr>
              {columns.map(c => <th key={c.key} className="text-left">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length} className="p-6 opacity-60">Loading…</td></tr>
            )}
            {!loading && rows?.length === 0 && (
              <tr><td colSpan={columns.length} className="p-6 opacity-60">No leads found</td></tr>
            )}
            {!loading && rows?.map(row => (
              <tr key={row.id} className="hover">
                {columns.map(col => {
                  const val = row[col.key];
                  const editable = ["status", "stage", "priority", "owner_name"].includes(col.key);
                  if (editable && col.key === "stage") {
                    return (
                      <td key={col.key}>
                        <select
                          value={row.stage || ""}
                          onChange={e => handleEdit(row.id, "stage", e.target.value)}
                          className="select select-sm"
                        >
                          {/* stages are dynamic in Kanban; here we offer a simple text entry */}
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
                      <td key={col.key}>
                        <select
                          value={row.status || ""}
                          onChange={e => handleEdit(row.id, "status", e.target.value)}
                          className="select select-sm"
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
                      <td key={col.key}>
                        <input
                          className="input input-sm"
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
                      <td key={col.key}>
                        <button className="link" onClick={() => onOpenLead(row.id)}>
                          {val || "(untitled)"}
                        </button>
                      </td>
                    );
                  }
                  if (col.key === "score") {
                    return (
                      <td key={col.key}>
                        <span className="badge">{val ?? "-"}</span>
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

      {/* Pagination */}
      <div className="flex items-center justify-between p-3">
        <div className="opacity-60">Total: {total ?? 0}</div>
        <div className="flex items-center gap-2">
          <select className="select select-sm" value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}>
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <button className="btn btn-sm" disabled={page<=1} onClick={() => onPageChange(page-1)}>Prev</button>
          <span className="px-2">Page {page} / {pageCount}</span>
          <button className="btn btn-sm" disabled={page>=pageCount} onClick={() => onPageChange(page+1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
