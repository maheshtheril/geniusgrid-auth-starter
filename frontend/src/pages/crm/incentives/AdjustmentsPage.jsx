// src/pages/crm/incentives/AdjustmentsPage.jsx
import React, { useMemo, useState } from "react";
import { Toolbar } from "@/pages/crm/_shared/Surface";
import { Modal } from "@/pages/crm/_shared/Modal";

const Chip = ({ value="Pending" }) => {
  const m = {
    Pending: "bg-amber-500/15 text-amber-300",
    Approved: "bg-emerald-500/15 text-emerald-300",
    Rejected: "bg-rose-500/15 text-rose-300",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${m[value]||"bg-white/10 text-slate-300"}`}>{value}</span>;
};

export function AdjustmentsPage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([
    { id:"a1", date:"2025-08-01", employee:"Rohan S", plan:"FY25 Growth", type:"Credit", amount:25000, reason:"Quarter-end true-up", status:"Approved" }
  ]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => [r.employee,r.plan,r.type,r.reason,r.status].some(v => String(v||"").toLowerCase().includes(s)));
  }, [q, rows]);

  const [form,setForm] = useState({ date:"", employee:"", plan:"FY25 Growth", type:"Credit", amount:"", reason:"", status:"Pending" });
  const canSubmit = form.date && form.employee.trim().length>=2 && Number(form.amount)>0;
  const submit = () => {
    if (!canSubmit) return;
    const id = "a"+Math.random().toString(36).slice(2,8);
    setRows(p => [{ id, ...form, amount:Number(form.amount) }, ...p]);
    setOpen(false);
    setForm({ date:"", employee:"", plan:"FY25 Growth", type:"Credit", amount:"", reason:"", status:"Pending" });
  };

  return (
    <div className="p-3 md:p-4">
      <div className="mb-3">
        <Toolbar onSearch={setQ} onFilter={()=>{}} onExport={()=>{}} onNew={()=> setOpen(true)} />
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-[#0f1217]/90 backdrop-blur border-b border-white/10">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-left">
              <th>Date</th><th>Employee</th><th>Plan</th><th>Type</th>
              <th className="text-right">Amount</th><th>Reason</th><th>Status</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr]:border-white/10">
            {filtered.length===0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No adjustments</td></tr>}
            {filtered.map(r=>(
              <tr key={r.id} className="hover:bg-white/5 transition-colors">
                <td className="px-3 py-3 whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.employee}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.plan}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.type}</td>
                <td className="px-3 py-3 whitespace-nowrap text-right">₹{r.amount.toLocaleString("en-IN")}</td>
                <td className="px-3 py-3">{r.reason}</td>
                <td className="px-3 py-3"><Chip value={r.status}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="New Adjustment" onClose={()=> setOpen(false)} onSubmit={submit} submitLabel="Create">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Date *</span>
            <input type="date" className="h-9 rounded-lg border bg-background px-3" value={form.date}
                   onChange={e=> setForm(p=>({...p, date:e.target.value}))} />
          </label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Employee *</span>
            <input className="h-9 rounded-lg border bg-background px-3" value={form.employee}
                   onChange={e=> setForm(p=>({...p, employee:e.target.value}))} />
          </label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Plan</span>
            <select className="h-9 rounded-lg border bg-background px-3" value={form.plan}
                    onChange={e=> setForm(p=>({...p, plan:e.target.value}))}>
              <option>FY25 Growth</option>
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Type</span>
            <select className="h-9 rounded-lg border bg-background px-3" value={form.type}
                    onChange={e=> setForm(p=>({...p, type:e.target.value}))}>
              <option>Credit</option><option>Debit</option>
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Amount *</span>
            <input type="number" min="0" className="h-9 rounded-lg border bg-background px-3" value={form.amount}
                   onChange={e=> setForm(p=>({...p, amount:e.target.value}))} />
          </label>
          <label className="grid gap-1 md:col-span-2"><span className="text-xs text-muted-foreground">Reason</span>
            <textarea className="min-h-[90px] rounded-lg border bg-background px-3 py-2" value={form.reason}
                      onChange={e=> setForm(p=>({...p, reason:e.target.value}))} />
          </label>
          {!canSubmit && <div className="md:col-span-2 text-xs text-red-400">Enter: <b>Date</b>, <b>Employee</b>, <b>Amount</b>.</div>}
        </div>
      </Modal>
    </div>
  );
}
