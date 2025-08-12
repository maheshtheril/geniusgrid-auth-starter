// src/components/layout/AppTopbar.jsx
import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useEnv } from "@/store/useEnv";

export default function AppTopbar() {
  const { user, companies, activeCompanyId, setActiveCompany } = useEnv();

  return (
    <header className="app-topbar gg-surface">
      {/* Left: brand */}
      <div className="brand">GeniusGrid</div>

      {/* Spacer */}
      <div className="spacer flex-1" />

      {/* Right: company switcher + theme + user */}
      <div className="flex items-center gap-2">
        {Array.isArray(companies) && companies.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="gg-muted text-xs hidden sm:inline">Company</span>
            <select
              className="gg-input h-9 px-2 rounded-md"
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
          </label>
        )}

        {/* Theme toggle – cycles light/dark/night (no extra side effects here) */}
        <ThemeToggle compact />

        <UserChip email={user?.email} />
      </div>
    </header>
  );
}

/* --- Small inline chip for the user/email --- */
function UserChip({ email }) {
  if (!email) return null;
  const initials = email?.[0]?.toUpperCase?.() || "U";
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-[color:var(--border)]">
      <div className="h-6 w-6 flex items-center justify-center rounded-full bg-[color:var(--panel)] border border-[color:var(--border)] text-[10px]">
        {initials}
      </div>
      <span className="gg-muted text-sm">{email}</span>
    </div>
  );
}
