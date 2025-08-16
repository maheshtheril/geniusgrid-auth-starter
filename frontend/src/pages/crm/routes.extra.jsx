/* --------------------------------- ROUTES ---------------------------------- */
// src/pages/crm/routes.extra.jsx (import these into App.jsx)
import React from "react";
import { Route } from "react-router-dom";
import ContactsLayout from "@/pages/crm/contacts/ContactsLayout";
import ContactsList from "@/pages/crm/contacts/ContactsList";
import CallsLayout from "@/pages/crm/calls/CallsLayout";
import CallsList from "@/pages/crm/calls/CallsList";
import TasksLayout from "@/pages/crm/tasks/TasksLayout";
import TasksList from "@/pages/crm/tasks/TasksList";
import ReportsLayout from "@/pages/crm/reports/ReportsLayout";
import ReportsOverview from "@/pages/crm/reports/ReportsOverview";
import NotificationsPage from "@/pages/crm/notifications/NotificationsPage";
import CrmSettingsPage from "@/pages/crm/settings/CrmSettingsPage";

export const crmExtraRoutes = (
  <>
    <Route path="contacts" element={<ContactsLayout />}>
      <Route index element={<ContactsList />} />
    </Route>
    <Route path="calls" element={<CallsLayout />}>
      <Route index element={<CallsList />} />
    </Route>
    <Route path="tasks" element={<TasksLayout />}>
      <Route index element={<TasksList />} />
    </Route>
    <Route path="reports" element={<ReportsLayout />}>
      <Route index element={<ReportsOverview />} />
    </Route>
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="settings" element={<CrmSettingsPage />} />
  </>
);