import React from "react";
import { NavLink } from "react-router-dom";

export default function AppSidebar() {
  const items = [
    { to: "/app/dashboard", label: "Dashboard" },
    { to: "/app/crm/leads", label: "Leads" },
    { to: "/app/crm/companies", label: "Companies" },
    { to: "/app/admin/org", label: "Admin" },
  ];
  return (
    <div className="h-full flex flex-col bg-card">
      <div className="h-14 flex items-center px-4 font-bold border-b">GeniusGrid</div>
      <nav className="flex-1 overflow-y-auto p-2">
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-md text-sm hover:bg-muted ${isActive ? "bg-muted" : ""}`
            }
          >
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
