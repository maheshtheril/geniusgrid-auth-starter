// src/components/layout/AppTopbar.jsx
import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useEnv } from "@/store/useEnv";

export default function AppTopbar() {
  const { user, companies, activeCompanyId, setActiveCompany } = useEnv();

  return (
    <header className="app-topbar panel glass">
      <div className="brand">GeniusGrid</div>
      <div className="spacer" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {companies?.length > 0 && (
          <select
            className="select"
            value={activeCompanyId || ""}
            onChange={(e) => setActiveCompany(e.target.value)}
            aria-label="Active company"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Theme toggle sits just before the user email */}
        <ThemeToggle />

        <div className="user-chip text-muted small">{user?.email}</div>
      </div>
    </header>
  );
}
