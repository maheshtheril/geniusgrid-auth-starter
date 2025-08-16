// ---------- FILE: src/pages/crm/incentives/PlansPage.jsx ----------
import React, { useMemo, useState } from "react";
import { Toolbar, StatusBadge } from "@/pages/crm/_shared/Surface";
import { Modal } from "@/pages/crm/_shared/Modal";

export function PlansPage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // demo rows (UI-only)
  const [rows, setRows] = useState([
    {
      id: "p1",
      name: "FY25 Growth",
      code: "FY25-G",
      status: "Active",
      period_from: "2025-04-01",
      period_to: "2026-03-31",
      base: "Revenue",
    },
  ]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s) ||
        r.base.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
    );
  }, [q, rows]);

  // create plan (local only)
  const [form, setForm] = useState({
    name: "",
    code: "",
    period_from: "",
    period_to: "",
    base: "Revenue",
  });
  const canSubmit =
    form.name.trim().length >= 2 &&
    form.code.trim().length >= 2 &&
    !!form.period_from &&
    !!form.period_to;

  const submit = () => {
    if (!canSubmit) return;
    const id = "p" + Math.random().toString(36).slice(2, 8);
    setRows((prev) => [
      {
        id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        status: "Draft",
        period_from: form.period_from,
        period_to: form.period_to,
        base: form.base,
      },
      ...prev,
    ]);
    setOpen(false);
    setForm({ name: "", code: "", period_from: "", period_to: "", base: "Revenue" });
  };

  return (
    <div className="p-3 md:p-4">
      <div className="mb-3">
        <Toolbar
          onSearch={setQ}
          onFilter={() => {}}
          onExport={() => {}}
          onNew={() => setOpen(true)}
        />
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-[#0f1217]/90 backdrop-blur border-b border-white/10">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-left">
              <th>Plan</th>
              <th>Code</th>
              <th>Status</th>
              <th>From</th>
              <th>To</th>
              <th>Base</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-white/10">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No plans
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-white/5 transition-colors">
                <td className="px-3 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3">{r.code}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-3">{r.period_from}</td>
                <td className="px-3 py-3">{r.period_to}</td>
                <td className="px-3 py-3">{r.base}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Plan */}
      <Modal
        open={open}
        title="New Plan"
        onClose={() => {
          setOpen(false);
          setForm({ name: "", code: "", period_from: "", period_to: "", base: "Revenue" });
        }}
        onSubmit={submit}
        submitLabel="Create"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Plan Name *</span>
            <input
              className="h-9 rounded-lg border bg-background px-3"
              placeholder="e.g., FY26 Max"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Code *</span>
            <input
              className="h-9 rounded-lg border bg-background px-3"
              placeholder="e.g., FY26-MAX"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Period From *</span>
            <input
              type="date"
              className="h-9 rounded-lg border bg-background px-3"
              value={form.period_from}
              onChange={(e) => setForm((p) => ({ ...p, period_from: e.target.value }))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Period To *</span>
            <input
              type="date"
              className="h-9 rounded-lg border bg-background px-3"
              value={form.period_to}
              onChange={(e) => setForm((p) => ({ ...p, period_to: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">Base</span>
            <select
              className="h-9 rounded-lg border bg-background px-3"
              value={form.base}
              onChange={(e) => setForm((p) => ({ ...p, base: e.target.value }))}
            >
              <option>Revenue</option>
              <option>Units</option>
              <option>Profit</option>
            </select>
          </label>

          {!canSubmit && (
            <div className="md:col-span-2 text-xs text-red-400">
              Enter at least: <b>Plan Name</b>, <b>Code</b>, <b>From</b>, <b>To</b>.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
