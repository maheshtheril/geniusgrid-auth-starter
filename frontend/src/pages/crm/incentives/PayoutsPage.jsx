// ---------- FILE: src/pages/crm/incentives/PayoutsPage.jsx ----------
import React, { useState } from "react";
import { Toolbar } from "./_shared/Toolbar";
import { DataTable } from "./_shared/DataTable";
import { Modal } from "./_shared/Modal";

export function PayoutsPage() {
  const [open, setOpen] = useState(false);
  const columns = [
    { key: "period", header: "Period" },
    { key: "status", header: "Status" },
    { key: "total_amt", header: "Total" },
    { key: "currency", header: "Currency" },
    { key: "generated_at", header: "Generated" },
  ];
  const rows = [
    { id: 1, period: "2025-08", status: "Open", total_amt: "₹0", currency: "INR", generated_at: "2025-08-15" },
  ];
  return (
    <>
      <Toolbar title="Payouts" onAdd={() => setOpen(true)} onFilter={() => {}} onExport={() => {}} />
      <DataTable columns={columns} rows={rows} />
      <Modal open={open} title="New Payout Run" onClose={() => setOpen(false)} onSubmit={() => setOpen(false)} submitLabel="Create Run">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs">Period (YYYY-MM)</span>
            <input className="h-9 rounded-lg border bg-background px-3" placeholder="2025-08" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs">Currency</span>
            <select className="h-9 rounded-lg border bg-background px-3"><option>INR</option><option>USD</option></select>
          </label>
        </div>
      </Modal>
    </>
  );
}

