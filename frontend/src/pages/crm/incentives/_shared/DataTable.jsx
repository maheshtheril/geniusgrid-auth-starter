// ---------- FILE: src/pages/crm/incentives/_shared/DataTable.jsx ----------
import React from "react";

export function DataTable({ columns = [], rows = [], empty = "No data" }) {
  return (
    <div className="overflow-auto">{/* vertical auto-scroll if large */}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left bg-muted/40">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={columns.length}>{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id || i} className="border-t hover:bg-muted/30">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {typeof c.render === "function" ? c.render(r[c.key], r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


