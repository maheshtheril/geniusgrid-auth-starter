// ---------- FILE: src/pages/admin/routes.jsx ----------
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

/* Admin shell (full-width) */
function AdminLayout() {
  return (
    <div className="min-h-[calc(100vh-56px)] p-4 md:p-6">
      <div className="mb-4 text-xl font-semibold">Admin</div>
      {/* ↓ where child routes render */}
      <Outlet />
    </div>
  );
}

/* Example pages — replace with your real ones / imports */
function AdminUsers()     { return <div>👤 Users</div>; }
function AdminRoles()     { return <div>🔐 Roles & Permissions</div>; }
function AdminSettings()  { return <div>⚙️ System Settings</div>; }
function AdminAuditLogs() { return <div>📜 Audit Logs</div>; }

/* ✅ DEFAULT EXPORT: nested routes under a parent with <Outlet/> */
export default function AdminRoutes() {
  return (
    <Routes>
      {/* parent route for /app/admin/* */}
      <Route path="/*" element={<AdminLayout />}>
        {/* /app/admin → redirect to /app/admin/users */}
        <Route index element={<Navigate to="users" replace />} />

        <Route path="users"    element={<AdminUsers />} />
        <Route path="roles"    element={<AdminRoles />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit"    element={<AdminAuditLogs />} />

        {/* catch-all inside /app/admin */}
        <Route path="*" element={<Navigate to="users" replace />} />
      </Route>
    </Routes>
  );
}
