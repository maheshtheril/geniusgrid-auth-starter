import React from "react";

/**
 * columns: [{ key, header, className? }]
 * rows: array of objects
 * renderCard: (row) => JSX (mobile)
 *
 * Renders cards on <sm, table on >=sm
 */
export default function ResponsiveTable({ columns, rows, renderCard, emptyText = "No data" }) {
  return (
    <div className="w-full">
      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-muted-foreground rounded-xl border border-white/10">
            {emptyText}
          </div>
        ) : (
          rows.map(renderCard)
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {columns.map(col => (
                <th key={col.key} className={`px-3 py-2 font-medium text-left ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">{emptyText}</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i} className="border-t hover:bg-muted/30">
                  {columns.map(col => (
                    <td key={col.key} className={`px-3 py-2 whitespace-nowrap ${col.className || ""}`}>
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
