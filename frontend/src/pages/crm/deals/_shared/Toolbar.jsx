// ---------- FILE: src/pages/crm/deals/_shared/Toolbar.jsx ----------
import React from "react";
import { Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Toolbar({
  title = "",
  onAdd,                 // if present, show a SOLID primary "+ New Deal"
  onFilter,              // if present, show Filters button
  onSearch,              // optional: (value)=>void
  searchPlaceholder = "Search…",
  addLabel = "New Deal",
  rightSlot = null,      // optional extra controls
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-3 pr-3 shadow-sm">
        <div className="text-base font-medium">{title}</div>
        <div className="flex-1" />

        {/* Search (desktop) */}
        {onSearch && (
          <div className="relative hidden md:block">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            <Input
              onChange={(e)=>onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8 h-9 w-[260px] shadow-sm focus:shadow focus:ring-0"
            />
          </div>
        )}

        {/* Optional extra slot */}
        {rightSlot}

        {/* Filters */}
        {onFilter && (
          <Button variant="secondary" className="gap-2" onClick={onFilter}>
            <Filter className="h-4" /> Filters
          </Button>
        )}

        {/* New Deal — solid primary, never dimmed when onAdd exists */}
        {onAdd && (
          <Button onClick={onAdd} className="gap-2 shadow hover:shadow-md active:scale-[0.99] transition pointer-events-auto">
            <Plus className="h-4" /> {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export default Toolbar;
