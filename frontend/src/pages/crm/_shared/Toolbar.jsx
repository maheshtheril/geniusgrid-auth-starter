// src/pages/crm/_shared/Toolbar.jsx
import React from "react";
import { Plus, Search, SlidersHorizontal, Download } from "lucide-react";

/**
 * Toolbar
 * - Left: title + optional children (chips, breadcrumbs, etc.)
 * - Right: (optional) Search, Filters, Export, New buttons, plus a rightSlot for anything custom.
 *
 * Props:
 *  - title: string
 *  - children: ReactNode (renders next to title on the left)
 *  - showSearch: boolean = true
 *  - searchValue?: string (controlled)
 *  - onSearchChange?: (e) => void (controlled)
 *  - searchPlaceholder: string = "Search…"
 *  - onFilter?: () => void
 *  - filterLabel: string = "Filters"
 *  - onExport?: () => void
 *  - exportLabel: string = "Export"
 *  - onAdd?: () => void
 *  - addLabel: string = "New"
 *  - rightSlot?: ReactNode (renders at far right)
 */
export function Toolbar({
  title,
  children,
  showSearch = true,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  onFilter,
  filterLabel = "Filters",
  onExport,
  exportLabel = "Export",
  onAdd,
  addLabel = "New",
  rightSlot,
}) {
  const isControlledSearch = typeof onSearchChange === "function";

  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-3">
      {/* Left: Title + extras */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {showSearch && (
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
            {isControlledSearch ? (
              <input
                value={searchValue ?? ""}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                aria-label="Search"
                className="h-9 pl-8 pr-3 rounded-lg border bg-background"
              />
            ) : (
              <input
                placeholder={searchPlaceholder}
                aria-label="Search"
                className="h-9 pl-8 pr-3 rounded-lg border bg-background"
              />
            )}
          </div>
        )}

        {onFilter && (
          <button
            type="button"
            className="h-9 px-3 rounded-lg border inline-flex items-center gap-2"
            onClick={onFilter}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filterLabel}
          </button>
        )}

        {onExport && (
          <button
            type="button"
            className="h-9 px-3 rounded-lg border inline-flex items-center gap-2"
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            {exportLabel}
          </button>
        )}

        {onAdd && (
          <button
            type="button"
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-2"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        )}

        {rightSlot ?? null}
      </div>
    </div>
  );
}

/* ------------------------------- HOW TO WIRE -------------------------------
1) Import where needed:
   import { Toolbar } from "@/pages/crm/_shared/Toolbar";

2) Use with built-in search (controlled):
   <Toolbar
     title="Contacts"
     searchValue={q}
     onSearchChange={(e) => setQ(e.target.value)}
     onAdd={() => setOpen(true)}
     addLabel="New Contact"
     onExport={() => ...}
     onFilter={() => ...}
   />

3) Or hide built-in search and render your own in `children`:
   <Toolbar
     title="Contacts"
     showSearch={false}
     onAdd={() => setOpen(true)}
   >
     <YourCustomSearch />
   </Toolbar>
---------------------------------------------------------------------------- */
