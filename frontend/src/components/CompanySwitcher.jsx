// -----------------------------------------------
// src/components/CompanySwitcher.jsx (styled)
// -----------------------------------------------
import { useEnv } from "@/store/useEnv";

export function CompanySwitcher() {
  const { companies, activeCompanyId, setActiveCompany } = useEnv();
  if (!companies?.length) return null;

  return (
    <select
      className="px-3 py-2 rounded-xl bg-white/5 text-white/90 text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
      value={activeCompanyId || ""}
      onChange={(e) => setActiveCompany(e.target.value)}
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id} className="bg-slate-900">
          {c.name}
        </option>
      ))}
    </select>
  );
}
