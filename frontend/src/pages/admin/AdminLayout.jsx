// ============================================================================
// GENIUSGRID ERP — ADMIN (Frontend-Only First)
// World-class, full-width admin UI. Backend can be wired later.
// Place these files under your frontend src/ tree exactly as shown below.
// ----------------------------------------------------------------------------
// ROUTING:
//   <Route path="/app/admin/*" element={<AdminRoutes />} />
//   All pages are standalone (no CRM sidebar) and render full-width.
//
// LIBS ASSUMED (already present in your repo):
//   - React + React Router
//   - Tailwind CSS
//   - lucide-react (icons)
//   - axios (optional but included)
//
// NOTES:
//   • Uses a safe fetcher() that tries live API and falls back to mock data.
//   • Tables: search, sort, paginate, CSV export.
//   • Forms in a Drawer with validation outline.
//   • Breadcrumbs + BuildBadge slot.
// ============================================================================

// ---------- FILE: src/pages/admin/routes/index.jsx ----------
// import React from "react";
// import { Routes, Route, Navigate } from "react-router-dom";
// import AdminLayout from "@/pages/admin/AdminLayout";
// import UsersPage from "@/pages/admin/pages/UsersPage";
// import RolesPage from "@/pages/admin/pages/RolesPage";
// import TenantsCompaniesPage from "@/pages/admin/pages/TenantsCompaniesPage";
// import MenusPage from "@/pages/admin/pages/MenusPage";
// import ModulesSettingsPage from "@/pages/admin/pages/ModulesSettingsPage";
// import SubscriptionsPage from "@/pages/admin/pages/SubscriptionsPage";
// import AuditLogsPage from "@/pages/admin/pages/AuditLogsPage";
// import SystemHealthPage from "@/pages/admin/pages/SystemHealthPage";

// export default function AdminRoutes(){
//   return (
//     <AdminLayout>
//       <Routes>
//         <Route index element={<Navigate to="users" replace />} />
//         <Route path="users" element={<UsersPage />} />
//         <Route path="roles" element={<RolesPage />} />
//         <Route path="tenants" element={<TenantsCompaniesPage />} />
//         <Route path="menus" element={<MenusPage />} />
//         <Route path="modules" element={<ModulesSettingsPage />} />
//         <Route path="subscriptions" element={<SubscriptionsPage />} />
//         <Route path="audit" element={<AuditLogsPage />} />
//         <Route path="system" element={<SystemHealthPage />} />
//         <Route path="*" element={<Navigate to="users" replace />} />
//       </Routes>
//     </AdminLayout>
//   );
// }

// ---------- FILE: src/pages/admin/AdminLayout.jsx ----------
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Users, Shield, Building2, PanelLeftClose, ListTree, Box, CreditCard, FileClock, Activity } from "lucide-react";

const TABS = [
  { to: "/app/admin/users",         label: "Users",         icon: Users },
  { to: "/app/admin/roles",         label: "Roles",         icon: Shield },
  { to: "/app/admin/tenants",       label: "Tenants & Co.", icon: Building2 },
  { to: "/app/admin/menus",         label: "Menus",         icon: ListTree },
  { to: "/app/admin/modules",       label: "Modules",       icon: Box },
  { to: "/app/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/app/admin/audit",         label: "Audit",         icon: FileClock },
  { to: "/app/admin/system",        label: "System",        icon: Activity },
];

export default function AdminLayout({ children }){
  const { pathname } = useLocation();
  return (
    <div className="w-full min-h-screen bg-[--gg-bg] text-[--gg-fg]">
      {/* Top header (keeps your global topbar above; this is page-level header) */}
      <header className="border-b gg-surface/70 backdrop-blur sticky top-0 z-20">
        <div className="px-6 py-3 flex items-center gap-3">
          <Home size={18} className="opacity-70" />
          <span className="uppercase tracking-wide text-xs opacity-70">Admin</span>
          <div className="flex-1" />
          {/* Optional slot for BuildBadge if you already have it globally */}
        </div>
        {/* Tabs */}
        <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map(({ to, label, icon:Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition ${
                (isActive || pathname.startsWith(to))
                  ? "bg-white/5 border-white/10"
                  : "border-transparent hover:bg-white/5"
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Full width content */}
      <main className="w-full max-w-none px-6 py-6">
        {children}
      </main>
    </div>
  );
}

