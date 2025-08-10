// src/components/CompanySwitcher.jsx
import { useEnv } from "@/store/useEnv";

export default function CompanySwitcher() {
  const { companies, activeCompanyId, setActiveCompany } = useEnv();
  if (!companies?.length) return null;

  return (
    <select
      className="border rounded px-2 py-1"
      value={activeCompanyId || ""}
      onChange={(e) => setActiveCompany(e.target.value)}
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
