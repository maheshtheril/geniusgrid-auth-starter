// ---------- FILE: src/pages/crm/incentives/ReportsPage.jsx ----------
import React from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";

export function ReportsPage() {
  const columns = [
    { key: "name", header: "Report" },
    { key: "period", header: "Period" },
    { key: "generated", header: "Generated" },
    { key: "actions", header: "Actions", render: (_, r) => (
      <div className="flex gap-2">
        <button className="h-8 px-2 rounded-lg border text-xs">View</button>
        <button className="h-8 px-2 rounded-lg border text-xs">Download</button>
      </div>
    ) },
  ];
  const rows = [
    { id: 1, name: "Payout Summary", period: "2025-08", generated: "2025-08-15" },
  ];
  return (
    <>
      <Toolbar title="Reports" onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
    </>
  );
}

