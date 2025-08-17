
// ---------- FILE: src/pages/admin/pages/SubscriptionsPage.jsx ----------
import React from "react";
import { CreditCard } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";

const MOCK = [
  { id:"s1", plan:"Free",   started:"2025-08-01", renews:"2025-09-01", status:"Active" },
  { id:"s2", plan:"Pro",    started:"2025-06-10", renews:"2025-09-10", status:"Active" },
];

export default function SubscriptionsPage(){
  const columns = [
    { key:"plan", header:"Plan" },
    { key:"started", header:"Started" },
    { key:"renews", header:"Renews" },
    { key:"status", header:"Status" },
  ];
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <CreditCard size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
      </div>
      <DataTable columns={columns} rows={MOCK} />
    </section>
  );
}

