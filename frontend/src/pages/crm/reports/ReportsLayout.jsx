/* --------------------------------- REPORTS --------------------------------- */
// src/pages/crm/reports/
import React from "react";
import { Outlet } from "react-router-dom";
import { BarChart3 } from "lucide-react";

export default function ReportsLayout(){
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><BarChart3 className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">CRM Reports</h1>
          <p className="text-sm text-muted-foreground">Overview metrics and detailed tables.</p>
        </div>
      </div>
      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet />
      </div>
    </div>
  );
}