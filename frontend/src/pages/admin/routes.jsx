// ---------- FILE: src/pages/admin/routes.jsx ----------
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

/* Admin shell (full-width) */
function AdminLayout({ children }) {
  return (
    <div className="min-h-[calc(100vh-56px)] p-4 md:p-6">
      <div className="mb-4 text-xl font-semibold">Admin</div>
      {children}
    </div>
  );
}

/* Example pages — swap these imports for your real ones */
function AdminUsers()      { return <div>👤 Users</div>; }
function AdminRoles()      { return <div>🔐 Roles & Permissions</div>; }
function AdminSettings()   { return <div>⚙️ System Settings</div>; }
function AdminAuditLogs()  { return <div>📜 Audit Logs</div>; }

/* ✅ DEFAULT EXPORT: a real component that renders nested <Routes> */
export default function AdminRoutes() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Navigate to="users" replace />} />

        <Route path="users"     element={<AdminUsers />} />
        <Route path="roles"     element={<AdminRoles />} />
        <Route path="settings"  element={<AdminSettings />} />
        <Route path="audit"     element={<AdminAuditLogs />} />

        {/* catch-all inside /admin */}
        <Route path="*" element={<Navigate to="users" replace />} />
      </Routes>
    </AdminLayout>
  );
}
