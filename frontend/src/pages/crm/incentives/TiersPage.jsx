// ---------- FILE: src/pages/crm/incentives/TiersPage.jsx ----------
import React, { useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";
import { Modal } from "./_shared/Modal";

export function TiersPage() {
  const [open, setOpen] = useState(false);
  const columns = [
    { key: "plan", header: "Plan" },
    { key: "level", header: "Level" },
    { key: "threshold", header: "Threshold" },
    { key: "rate_type", header: "Rate Type" },
    { key: "rate", header: "Rate" },
  ];
  const rows = [
    { id: 1, plan: "FY25 Growth", level: "Gold", threshold: "₹1 Cr", rate_type: "%", rate: "2.5%" },
  ];
  return (
    <>
      <Toolbar title="Tiers" onAdd={() => setOpen(true)} onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
      <Modal open={open} title="New Tier" onClose={() => setOpen(false)} onSubmit={() => setOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs">Plan</span>
            <select className="h-9 rounded-lg border bg-background px-3"><option>FY25 Growth</option></select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Level Label</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="Gold / Silver / Bronze" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Threshold</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="e.g., ₹1,00,00,000" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Rate Type</span>
            <select className="h-9 rounded-lg border bg-background px-3"><option>%</option><option>Flat</option></select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Rate</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="e.g., 2.5 or 10,000" />
          </label>
        </div>
      </Modal>
    </>
  );
}
