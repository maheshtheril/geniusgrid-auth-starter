// ---------- FILE: src/pages/crm/incentives/ProgramsPage.jsx ----------
import React, { useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";
import { Modal } from "./_shared/Modal";

export function ProgramsPage() {
  const [open, setOpen] = useState(false);
  const columns = [
    { key: "name", header: "Program" },
    { key: "applies_to", header: "Applies To" },
    { key: "start", header: "Start" },
    { key: "end", header: "End" },
    { key: "status", header: "Status" },
  ];
  const rows = [
    { id: 1, name: "Monsoon Booster", applies_to: "Leads", start: "2025-06-01", end: "2025-09-30", status: "Active" },
  ];
  return (
    <>
      <Toolbar title="Programs" onAdd={() => setOpen(true)} onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
      <Modal open={open} title="New Program" onClose={() => setOpen(false)} onSubmit={() => setOpen(false)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs">Program Name</span>
            <input className="h-9 rounded-lg border bg-background px-3" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Applies To</span>
            <select className="h-9 rounded-lg border bg-background px-3"><option>Leads</option><option>Deals</option><option>Calls</option></select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Start</span>
            <input type="date" className="h-9 rounded-lg border bg-background px-3" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">End</span>
            <input type="date" className="h-9 rounded-lg border bg-background px-3" />
          </label>
        </div>
      </Modal>
    </>
  );
}