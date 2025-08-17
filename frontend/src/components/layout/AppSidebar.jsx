// src/components/layout/AppSidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Users, Briefcase, Settings } from "lucide-react";

const MENUS = [
  { to: "/app/dashboard", label: "Dashboard", icon: Home },
  { to: "/app/crm/leads", label: "Leads", icon: Users },
  { to: "/app/crm/companies", label: "Companies", icon: Briefcase },
  { to: "/app/admin/org", label: "Admin", icon: Settings },
];

export default function AppSidebar({ onRequestClose }) {
  return (
    <div className="h-full flex flex-col bg-card text-foreground">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 font-bold border-b">
        GeniusGrid
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-2">
        {MENUS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted ${
                isActive ? "bg-muted text-primary" : ""
              }`
            }
            onClick={() => onRequestClose?.()}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
