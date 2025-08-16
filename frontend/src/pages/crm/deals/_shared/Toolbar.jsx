// ---------- FILE: src/pages/crm/deals/_shared/Toolbar.jsx ----------
import React from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";

export function Toolbar({ title, onAdd, onFilter, children }){
  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
          <input className="h-9 pl-8 pr-3 rounded-lg border bg-background" placeholder="Search…" />
        </div>
        <button className="h-9 px-3 rounded-lg border inline-flex items-center gap-2" onClick={onFilter}>
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
        {onAdd && (
          <button className="h-9 px-3 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-2" onClick={onAdd}>
            <Plus className="h-4 w-4" /> New Deal
          </button>
        )}
      </div>
    </div>
  );
}