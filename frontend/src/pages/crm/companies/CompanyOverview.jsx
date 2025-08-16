// ---------- FILE: src/pages/crm/companies/CompanyOverview.jsx ----------
import React from "react";
import { useOutletContext } from "react-router-dom";

const Card = ({ title, value, sub }) => (
  <div className="p-4 rounded-xl border bg-background">
    <div className="text-xs text-muted-foreground">{title}</div>
    <div className="text-2xl font-semibold">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export default function CompanyOverview(){
  const { company } = useOutletContext();
  // demo numbers
  const stats = { deals: 3, revenue: 2100000, lastActivity: "2025-08-16 10:15" };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card title="Open Deals" value={stats.deals} />
        <Card title="Revenue to date" value={`₹${stats.revenue.toLocaleString('en-IN')}`} />
        <Card title="Last activity" value={stats.lastActivity} />
      </div>
      <div className="p-4 rounded-xl border bg-background">
        <div className="font-medium mb-2">Company Info</div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Domain:</span> {company.domain || '-'}</div>
          <div><span className="text-muted-foreground">Industry:</span> {company.industry || '-'}</div>
          <div><span className="text-muted-foreground">Owner:</span> {company.owner || '-'}</div>
          <div><span className="text-muted-foreground">Location:</span> {company.city}, {company.country}</div>
        </div>
      </div>
    </div>
  );
}
