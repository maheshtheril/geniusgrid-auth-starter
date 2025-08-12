// src/components/layout/AppTopbar.jsx (or Topbar.jsx)
import { useEnv } from "@/store/useEnv";

export default function AppTopbar() {
  const { user, companies, activeCompanyId, setActiveCompany } = useEnv();
  return (
    <header className="app-topbar gg-surface">
      <div className="brand">GeniusGrid</div>
      <div className="spacer" />
      {companies?.length > 0 && (
        <select
          className="gg-input"
          value={activeCompanyId || ""}
          onChange={(e) => setActiveCompany(e.target.value)}
          aria-label="Active company"
        >
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div className="gg-muted text-sm">{user?.email}</div>
    </header>
  );
}
