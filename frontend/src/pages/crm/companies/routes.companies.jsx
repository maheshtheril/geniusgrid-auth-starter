import { lazy, Suspense } from "react";
// ---------- FILE: src/pages/crm/companies/routes.companies.jsx ----------
import React from "react";
import { Route } from "react-router-dom";
const CompaniesPage = lazy(() => import("@/pages/CompaniesPage.jsx")); // your existing list page
import CompanyLayout from "./CompanyLayout";
import CompanyIndexRedirect from "./IndexRedirect";
import CompanyOverview from "./CompanyOverview";
import CompanyPeople from "./CompanyPeople";
import CompanyDeals from "./CompanyDeals";
import CompanyActivity from "./CompanyActivity";

export const crmCompanyRoutes = (
  <>
    {/* Companies list under CRM */}
    <Route path="companies" element={<Suspense fallback={<div className="p-4 text-sm">Loading Companies…</div>}><CompaniesPage /></Suspense>} />

    {/* Company detail */}
    <Route path="companies/:companyId" element={<CompanyLayout />}>
      <Route index element={<CompanyIndexRedirect />} />
      <Route path="overview" element={<CompanyOverview />} />
      <Route path="people" element={<CompanyPeople />} />
      <Route path="deals" element={<CompanyDeals />} />
      <Route path="activity" element={<CompanyActivity />} />
    </Route>
  </>
);