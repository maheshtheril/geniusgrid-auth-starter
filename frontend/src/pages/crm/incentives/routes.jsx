// ---------- FILE: src/pages/crm/incentives/routes.jsx ----------
// Convenience bundle to import in App routing
import React from "react";
import IncentivesLayout from "./IncentivesLayout";
import IncentivesIndexRedirect from "./IndexRedirect";
import { PlansPage } from "./PlansPage";
import { RulesPage } from "./RulesPage";
import { TiersPage } from "./TiersPage";
import { ProgramsPage } from "./ProgramsPage";
import { PayoutsPage } from "./PayoutsPage";
import { AdjustmentsPage } from "./AdjustmentsPage";
import { ApprovalsPage } from "./ApprovalsPage";
import { ReportsPage } from "./ReportsPage";
import { AuditPage } from "./AuditPage";

export const incentivesRoutes = (
  <>
    <Route path="/app/crm/incentives" element={<IncentivesLayout />}> 
      <Route index element={<IncentivesIndexRedirect />} />
      <Route path="plans" element={<PlansPage />} />
      <Route path="rules" element={<RulesPage />} />
      <Route path="tiers" element={<TiersPage />} />
      <Route path="programs" element={<ProgramsPage />} />
      <Route path="payouts" element={<PayoutsPage />} />
      <Route path="adjustments" element={<AdjustmentsPage />} />
      <Route path="approvals" element={<ApprovalsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="audit" element={<AuditPage />} />
    </Route>
  </>
);