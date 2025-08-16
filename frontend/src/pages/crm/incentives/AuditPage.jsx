// ---------- FILE: src/pages/crm/incentives/AuditPage.jsx ----------
import React from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";

export function AuditPage() {
  const columns = [
    { key: "ts", header: "Timestamp" },
    { key: "actor", header: "Actor" },
    { key: "action", header: "Action" },
    { key: "entity", header: "Entity" },
    { key: "entity_id", header: "ID" },
    { key: "details", header: "Details" },
  ];
  const rows = [
    { id: 1, ts: "2025-08-15 12:48", actor: "system", action: "payout_open", entity: "payouts", entity_id: "2025-08", details: "Seeded open period" },
  ];
  return (
    <>
      <Toolbar title="Audit" onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
    </>
  );
}