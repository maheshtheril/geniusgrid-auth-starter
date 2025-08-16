// ---------- FILE: src/pages/crm/incentives/PlansPage.jsx ----------
import React, { useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";
import { Modal } from "./_shared/Modal";

export function PlansPage() {
  const [open, setOpen] = useState(false);
  const columns = [
    { key: "name", header: "Plan" },
    { key: "code", header: "Code" },
    { key: "status", header: "Status" },
    { key: "period_from", header: "From" },
    { key: "period_to", header: "To" },
    { key: "base", header: "Base" },
  ];
  const rows = [
    { id: 1, name: "FY25 Growth", code: "FY25-G", status: "Active", period_from: "2025-04-01", period_to: "2026-03-31", base: "Revenue" },
  ];
  return (
    <>
      <Toolbar title="Plans" onAdd={() => setOpen(true)} onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
      <Modal open={open} title="New Plan" onClose={() => setOpen(false)} onSubmit={() => setOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Plan Name</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="e.g., FY26 Max" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Code</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="e.g., FY26-MAX" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Period From</span>
            <input type="date" className="h-9 rounded-lg border bg-background px-3" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Period To</span>
            <input type="date" className="h-9 rounded-lg border bg-background px-3" />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">Base</span>
            <select className="h-9 rounded-lg border bg-background px-3">
              <option>Revenue</option>
              <option>Units</option>
              <option>Profit</option>
            </select>
          </label>
        </div>
      </Modal>
    </>
  );
}



