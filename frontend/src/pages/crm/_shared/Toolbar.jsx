// =============================
// CRM Core UI Pack (UI-first, no new deps)
// Modules:
//   - Contacts: List + Drawer + mock API
//   - Calls: List + (light) Calendar + Drawer + mock API
//   - Tasks: List (status dropdown) + Drawer + mock API
//   - Reports: Overview with cards + inline bars (CSS) + table
//   - Notifications: Simple feed/list
//   - Settings: Module toggles (UI only)
// Routes under /app/crm/{contacts|calls|tasks|reports|notifications|settings}
// Uses Tailwind + lucide-react. No extra libraries.
// =============================

/* ---------------------------- SHARED UI ELEMENTS --------------------------- */
// src/pages/crm/_shared/Toolbar.jsx
import React from "react";
import { Plus, Search, SlidersHorizontal, Download } from "lucide-react";

export function Toolbar({ title, onAdd, onFilter, onExport, children }) {
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
        {onFilter && (
          <button className="h-9 px-3 rounded-lg border inline-flex items-center gap-2" onClick={onFilter}>
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
        )}
        {onExport && (
          <button className="h-9 px-3 rounded-lg border inline-flex items-center gap-2" onClick={onExport}>
            <Download className="h-4 w-4" /> Export
          </button>
        )}
        {onAdd && (
          <button className="h-9 px-3 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-2" onClick={onAdd}>
            <Plus className="h-4 w-4" /> New
          </button>
        )}
      </div>
    </div>
  );
}



























/* ------------------------------- HOW TO WIRE ------------------------------- */
// 1) Create the folders & files as above under src/pages/crm/*
// 2) In App.jsx, inside: <Route path="/app/*" element={<ProtectedShell />}> <Route path="crm" element={<CrmOutlet />}> ... add:
//    {crmExtraRoutes} siblings alongside your deals/incentives/leads.
//    Example:
//
// <Route path="/app/*" element={<ProtectedShell />}>
//   <Route path="crm" element={<CrmOutlet />}>
//     {/* existing leads/deals/incentives ... */}
//     {crmExtraRoutes}
//   </Route>
// </Route>
//
// 3) No new npm deps required.
