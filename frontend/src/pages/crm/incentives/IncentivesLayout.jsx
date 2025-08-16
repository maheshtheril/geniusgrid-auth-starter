// =============================
// CRM Incentives UI Pack
// Layout + Subroutes + Pages + Shared UI
// TailwindCSS + React Router v6 + lucide-react (optional)
// =============================

// ---------- FILE: src/pages/crm/incentives/IncentivesLayout.jsx ----------
import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Percent, BadgePercent, Settings2 } from "lucide-react";

const TABS = [
  { to: "/app/crm/incentives/plans", label: "Plans" },
  { to: "/app/crm/incentives/rules", label: "Rules" },
  { to: "/app/crm/incentives/tiers", label: "Tiers" },
  { to: "/app/crm/incentives/programs", label: "Programs" },
  { to: "/app/crm/incentives/payouts", label: "Payouts" },
  { to: "/app/crm/incentives/adjustments", label: "Adjustments" },
  { to: "/app/crm/incentives/approvals", label: "Approvals" },
  { to: "/app/crm/incentives/reports", label: "Reports" },
  { to: "/app/crm/incentives/audit", label: "Audit" },
];

export default function IncentivesLayout() {
  const loc = useLocation();
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center">
          <BadgePercent className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Incentives</h1>
          <p className="text-sm text-muted-foreground">Configure plans, rules & tiers, and manage payouts with approvals, reports & audit.</p>
        </div>
        <div className="flex-1" />
        <NavLink to="/app/crm/incentives/settings" className="hidden md:inline-flex items-center gap-2 text-sm px-3 h-9 rounded-lg border hover:bg-accent">
          <Settings2 className="h-4 w-4" />
          Settings
        </NavLink>
      </div>

      {/* Tabs */}
      <div className="w-full overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-muted">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `px-4 h-9 inline-flex items-center rounded-lg whitespace-nowrap text-sm transition ${
                  isActive || loc.pathname.startsWith(t.to)
                    ? "bg-background shadow border"
                    : "hover:bg-background/60"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet />
      </div>
    </div>
  );
}




// ========== PAGES ==========






// ---------- HOW TO WIRE (add to your App.jsx) ----------
// import { Routes, Route } from "react-router-dom";
// import IncentivesLayout from "@/pages/crm/incentives/IncentivesLayout";
// import IncentivesIndexRedirect from "@/pages/crm/incentives/IndexRedirect";
// import { PlansPage } from "@/pages/crm/incentives/PlansPage";
// import { RulesPage } from "@/pages/crm/incentives/RulesPage";
// import { TiersPage } from "@/pages/crm/incentives/TiersPage";
// import { ProgramsPage } from "@/pages/crm/incentives/ProgramsPage";
// import { PayoutsPage } from "@/pages/crm/incentives/PayoutsPage";
// import { AdjustmentsPage } from "@/pages/crm/incentives/AdjustmentsPage";
// import { ApprovalsPage } from "@/pages/crm/incentives/ApprovalsPage";
// import { ReportsPage } from "@/pages/crm/incentives/ReportsPage";
// import { AuditPage } from "@/pages/crm/incentives/AuditPage";
//
// <Routes>
//   {/* ...other routes... */}
//   <Route path="/app/crm/incentives" element={<IncentivesLayout />}> 
//     <Route index element={<IncentivesIndexRedirect />} />
//     <Route path="plans" element={<PlansPage />} />
//     <Route path="rules" element={<RulesPage />} />
//     <Route path="tiers" element={<TiersPage />} />
//     <Route path="programs" element={<ProgramsPage />} />
//     <Route path="payouts" element={<PayoutsPage />} />
//     <Route path="adjustments" element={<AdjustmentsPage />} />
//     <Route path="approvals" element={<ApprovalsPage />} />
//     <Route path="reports" element={<ReportsPage />} />
//     <Route path="audit" element={<AuditPage />} />
//   </Route>
// </Routes>
