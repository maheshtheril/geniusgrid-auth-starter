// ---------- FILE: src/pages/admin/_shared/DataTable.jsx ----------
import React, { useMemo, useState } from "react";

export default function DataTable({ columns, rows, initialPageSize = 10, onRowClick }){
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle));
  }, [rows, q]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const s = [...filtered].sort((a,b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (sort.dir === "asc" ? 1 : -1);
    });
    return s;
  }, [filtered, sort]);

  const total = sorted.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  function toggleSort(key){
    setSort(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  function exportCSV(){
    const headers = columns.map(c => c.header);
    const keys = columns.map(c => c.key);
    const lines = [headers.join(",")];
    for (const r of sorted){
      lines.push(keys.map(k => JSON.stringify(r[k] ?? "")).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `export_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          placeholder="Search…"
          value={q}
          onChange={e=>{ setPage(1); setQ(e.target.value); }}
          className="gg-input h-9 px-3 rounded-md min-w-[200px]"
        />
        <div className="flex-1" />
        <button onClick={exportCSV} className="gg-btn">Export CSV</button>
        <select value={pageSize} onChange={e=>{setPage(1); setPageSize(Number(e.target.value));}} className="gg-input h-9 px-2 rounded-md">
          {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
      </div>

      <div className="overflow-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="text-left px-3 py-2 font-medium whitespace-nowrap select-none cursor-pointer" onClick={()=>toggleSort(col.key)}>
                  <div className="flex items-center gap-1">
                    <span>{col.header}</span>
                    {sort.key === col.key && <span className="opacity-60">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r,idx) => (
              <tr key={r.id || idx} className="border-t border-white/5 hover:bg-white/3" onClick={()=>onRowClick?.(r)}>
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                    {col.render ? col.render(r[col.key], r) : String(r[col.key] ?? "").trim() || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-sm opacity-70" colSpan={columns.length}>No results</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs opacity-70">{total} items</span>
        <div className="flex-1" />
        <button className="gg-btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span className="text-xs opacity-70">Page {page} / {lastPage}</span>
        <button className="gg-btn" disabled={page>=lastPage} onClick={()=>setPage(p=>Math.min(lastPage,p+1))}>Next</button>
      </div>
    </div>
  );
}

