import React from "react";
import { Route } from "react-router-dom";
import RBACRoute from "@/routes/RBACRoute";
import AdminLayout from "./layout/AdminLayout";

// Lazy-load pages
const UsersPage          = React.lazy(() => import("./pages/users/UsersPage.jsx"));
const RolesPage          = React.lazy(() => import("./pages/roles/RolesPage.jsx"));
const CompaniesAdminPage = React.lazy(() => import("./pages/companies/CompaniesAdminPage.jsx"));
const TenantsPage        = React.lazy(() => import("./pages/tenants/TenantsPage.jsx"));
const SettingsPage       = React.lazy(() => import("./pages/settings/SettingsPage.jsx"));
const AuditPage          = React.lazy(() => import("./pages/audit/AuditPage.jsx"));
const NotificationsPage  = React.lazy(() => import("./pages/notifications/NotificationsPage.jsx"));
const ReportsPage        = React.lazy(() => import("./pages/reports/ReportsPage.jsx"));
const BillingPage        = React.lazy(() => import("./pages/billing/BillingPage.jsx"));
const IntegrationsPage   = React.lazy(() => import("./pages/integrations/IntegrationsPage.jsx"));
const ApiKeysPage        = React.lazy(() => import("./pages/api-keys/ApiKeysPage.jsx"));
const SecurityCenterPage = React.lazy(() => import("./pages/security/SecurityCenterPage.jsx"));
const DataRetentionPage  = React.lazy(() => import("./pages/data/DataRetentionPage.jsx"));
const BrandingPage       = React.lazy(() => import("./pages/branding/BrandingPage.jsx"));

const Fallback = ({ label = "Loading…" }) => (
  <div className="p-6 text-sm text-muted-foreground">{label}</div>
);

export const adminRoutes = (
  <Route
    path="admin"
    element={
      <RBACRoute need={["admin.access"]}>
        <React.Suspense fallback={<Fallback label="Loading Admin…" />}>
          <AdminLayout />
        </React.Suspense>
      </RBACRoute>
    }
  >
    <Route index element={<React.Suspense fallback={<Fallback />}><UsersPage /></React.Suspense>} />
    <Route path="users" element={<React.Suspense fallback={<Fallback />}><UsersPage /></React.Suspense>} />
    <Route path="roles" element={<React.Suspense fallback={<Fallback />}><RolesPage /></React.Suspense>} />
    <Route path="companies" element={<React.Suspense fallback={<Fallback />}><CompaniesAdminPage /></React.Suspense>} />
    <Route path="tenants" element={<React.Suspense fallback={<Fallback />}><TenantsPage /></React.Suspense>} />
    <Route path="settings" element={<React.Suspense fallback={<Fallback />}><SettingsPage /></React.Suspense>} />
    <Route path="audit" element={<React.Suspense fallback={<Fallback />}><AuditPage /></React.Suspense>} />
    <Route path="notifications" element={<React.Suspense fallback={<Fallback />}><NotificationsPage /></React.Suspense>} />
    <Route path="reports" element={<React.Suspense fallback={<Fallback />}><ReportsPage /></React.Suspense>} />
    <Route path="billing" element={<React.Suspense fallback={<Fallback />}><BillingPage /></React.Suspense>} />
    <Route path="integrations" element={<React.Suspense fallback={<Fallback />}><IntegrationsPage /></React.Suspense>} />
    <Route path="api-keys" element={<React.Suspense fallback={<Fallback />}><ApiKeysPage /></React.Suspense>} />
    <Route path="security" element={<React.Suspense fallback={<Fallback />}><SecurityCenterPage /></React.Suspense>} />
    <Route path="data" element={<React.Suspense fallback={<Fallback />}><DataRetentionPage /></React.Suspense>} />
    <Route path="branding" element={<React.Suspense fallback={<Fallback />}><BrandingPage /></React.Suspense>} />
  </Route>
);
