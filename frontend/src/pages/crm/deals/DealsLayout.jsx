// =============================
// CRM Deals UI Pack (UI-only, mock API)
// - Pipeline (Kanban) with drag → updates stage (mock save)
// - List (table) with filters/search and pagination (client-side mock)
// - Deal Drawer (view/edit) modal
// - Routes under /app/crm/deals/{pipeline|list}
// Requires: React Router v6, TailwindCSS, lucide-react, @dnd-kit/core
// =============================

// ---------- FILE: src/pages/crm/deals/DealsLayout.jsx ----------
import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Briefcase } from "lucide-react";

const TABS = [
  { to: "/app/crm/deals/pipeline", label: "Pipeline" },
  { to: "/app/crm/deals/list", label: "List" },
];

export default function DealsLayout(){
  const loc = useLocation();
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">Manage the sales pipeline and deal list with fast filters and editing.</p>
        </div>
        <div className="flex-1" />
      </div>

      <div className="w-full overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-muted">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({isActive}) => `px-4 h-9 inline-flex items-center rounded-lg whitespace-nowrap text-sm transition ${
                isActive || loc.pathname.startsWith(t.to) ? 'bg-background shadow border' : 'hover:bg-background/60'
              }`}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet />
      </div>
    </div>
  );
}







// ---------- HOW TO WIRE (add to your App.jsx) ----------
// import { Routes, Route } from "react-router-dom";
// import DealsLayout from "@/pages/crm/deals/DealsLayout";
// import DealsIndexRedirect from "@/pages/crm/deals/IndexRedirect";
// import DealsPipeline from "@/pages/crm/deals/DealsPipeline";
// import DealsList from "@/pages/crm/deals/DealsList";
//
// <Routes>
//   {/* ...other routes... */}
//   <Route path="/app/crm/deals" element={<DealsLayout />}> 
//     <Route index element={<DealsIndexRedirect />} />
//     <Route path="pipeline" element={<DealsPipeline />} />
//     <Route path="list" element={<DealsList />} />
//   </Route>
// </Routes>
