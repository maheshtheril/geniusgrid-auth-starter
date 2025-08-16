// ---------- FILE: src/pages/crm/companies/routes.companies.jsx ----------
import React from "react";
import { Route } from "react-router-dom";
import CompaniesPage from "@/pages/CompaniesPage"; // your existing list page
import CompanyLayout from "./CompanyLayout";
import CompanyIndexRedirect from "./IndexRedirect";
import CompanyOverview from "./CompanyOverview";
import CompanyPeople from "./CompanyPeople";
import CompanyDeals from "./CompanyDeals";
import CompanyActivity from "./CompanyActivity";

export const crmCompanyRoutes = (
  <>
    {/* Companies list under CRM */}
    <Route path="companies" element={<CompaniesPage />} />

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