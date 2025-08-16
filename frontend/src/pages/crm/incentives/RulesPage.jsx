// ---------- FILE: src/pages/crm/incentives/RulesPage.jsx ----------
import React, { useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";
import { Modal } from "./_shared/Modal";

export function RulesPage() {
  const [open, setOpen] = useState(false);
  const columns = [
    { key: "name", header: "Rule" },
    { key: "plan", header: "Plan" },
    { key: "metric", header: "Metric" },
    { key: "condition", header: "Condition" },
    { key: "reward", header: "Reward" },
    { key: "active", header: "Active" },
  ];
  const rows = [
    { id: 1, name: "Qtr Target Bonus", plan: "FY25 Growth", metric: "Revenue", condition: ">= 50L", reward: "+2%", active: "Yes" },
  ];
  return (
    <>
      <Toolbar title="Rules" onAdd={() => setOpen(true)} onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
      <Modal open={open} title="New Rule" onClose={() => setOpen(false)} onSubmit={() => setOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs">Rule Name</span>
            <input className="h-9 rounded-lg border bg-background px-3" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Plan</span>
            <select className="h-9 rounded-lg border bg-background px-3"><option>FY25 Growth</option></select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Metric</span>
            <select className="h-9 rounded-lg border bg-background px-3"><option>Revenue</option><option>Units</option></select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Condition</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder=">= 50L" />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs">Reward</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="e.g., +2% or 10,000 INR" />
          </label>
        </div>
      </Modal>
    </>
  );
}

