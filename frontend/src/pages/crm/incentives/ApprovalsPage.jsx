// ---------- FILE: src/pages/crm/incentives/ApprovalsPage.jsx ----------
import React from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";

export function ApprovalsPage() {
  const columns = [
    { key: "type", header: "Type" },
    { key: "requester", header: "Requester" },
    { key: "approver", header: "Approver" },
    { key: "status", header: "Status" },
    { key: "submitted", header: "Submitted" },
  ];
  const rows = [
    { id: 1, type: "Adjustment", requester: "Ops", approver: "Finance", status: "Pending", submitted: "2025-08-14" },
  ];
  return (
    <>
      <Toolbar title="Approvals" onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
    </>
  );
}



