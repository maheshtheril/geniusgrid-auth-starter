import Page from "./Page";
import React from "react";
import { Route, Outlet } from "react-router-dom";

import Users from "./Users";
import Roles from "./Roles";
import Companies from "./Companies";
import Tenants from "./Tenants";
import Settings from "./Settings";
import Audit from "./Audit";
import Notifications from "./Notifications";
import Reports from "./Reports";
import Billing from "./Billing";
import Integrations from "./Integrations";
import ApiKeys from "./ApiKeys";
import Security from "./Security";
import Data from "./Data";
import Branding from "./Branding";

export const adminRoutes = (
  <Route path="admin" element={<Outlet />}>
    <Route index element={<Users />} />
    <Route path="users" element={<Users />} />
    <Route path="roles" element={<Roles />} />
    <Route path="companies" element={<Companies />} />
    <Route path="tenants" element={<Tenants />} />
    <Route path="settings" element={<Settings />} />
    <Route path="audit" element={<Audit />} />
    <Route path="notifications" element={<Notifications />} />
    <Route path="reports" element={<Reports />} />
    <Route path="billing" element={<Billing />} />
    <Route path="integrations" element={<Integrations />} />
    <Route path="api-keys" element={<ApiKeys />} />
    <Route path="security" element={<Security />} />
    <Route path="data" element={<Data />} />
    <Route path="branding" element={<Branding />} />
  </Route>
);

export default adminRoutes;
