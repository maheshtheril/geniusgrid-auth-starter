// ---------- FILE: src/pages/crm/companies/CompanyLayout.jsx ----------
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft } from "lucide-react";
import { getCompany } from "./mockApi";

const TABS = [
  { to: "overview", label: "Overview" },
  { to: "people", label: "People" },
  { to: "deals", label: "Deals" },
  { to: "activity", label: "Activity" },
];

export default function CompanyLayout(){
  const { companyId } = useParams();
  const nav = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ (async()=>{ setLoading(true); setCompany(await getCompany(companyId)); setLoading(false); })(); },[companyId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!company) return (
    <div className="p-6 space-y-3">
      <button className="text-sm underline" onClick={()=> nav(-1)}><ArrowLeft className="inline h-4 w-4"/> Back</button>
      <div className="text-lg">Company not found.</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Building2 className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.industry} • Owner: {company.owner} • {company.city}, {company.country}</p>
        </div>
        <div className="flex-1" />
        <button className="h-9 px-3 rounded-lg border text-sm" onClick={()=> nav("/app/crm/companies")}>All Companies</button>
      </div>

      {/* Tabs */}
      <div className="w-full overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-muted">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({isActive}) => `px-4 h-9 inline-flex items-center rounded-lg whitespace-nowrap text-sm transition ${isActive ? 'bg-background shadow border' : 'hover:bg-background/60'}`}
            >{t.label}</NavLink>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet context={{ company }} />
      </div>
    </div>
  );
}
