// ---------- FILE: src/pages/crm/incentives/AdjustmentsPage.jsx ----------
import React, { useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";
import { Modal } from "./_shared/Modal";

export function AdjustmentsPage() {
  const [open, setOpen] = useState(false);
  const columns = [
    { key: "date", header: "Date" },
    { key: "employee", header: "Employee" },
    { key: "amount", header: "Amount" },
    { key: "reason", header: "Reason" },
    { key: "status", header: "Status" },
  ];
  const rows = [
    { id: 1, date: "2025-08-12", employee: "A. Khan", amount: "+₹2,000", reason: "Manual bonus", status: "Approved" },
  ];
  return (
    <>
      <Toolbar title="Adjustments" onAdd={() => setOpen(true)} onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
      <Modal open={open} title="New Adjustment" onClose={() => setOpen(false)} onSubmit={() => setOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs">Employee</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="Search name…" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Amount (±)</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="e.g., -500 or 2000" />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs">Reason</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="Short note" />
          </label>
        </div>
      </Modal>
    </>
  );
}
