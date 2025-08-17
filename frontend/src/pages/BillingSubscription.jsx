import React, { useState } from "react";
export default function BillingSubscription(){
  const [plan, setPlan] = useState("Pro");
  const [seats, setSeats] = useState(10);
  const invoices = [{ id:"INV-001", date:"2025-08-01", amount:"₹12,000", status:"paid" }];
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Billing & Subscription</div><h1 className="text-2xl md:text-3xl font-bold">Billing & Subscription</h1></div>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-3">
          <div className="font-semibold">Plan</div>
          <select className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={plan} onChange={e=>setPlan(e.target.value)}>
            <option>Starter</option><option>Pro</option><option>Enterprise</option>
          </select>
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Seats</div>
            <input type="number" className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={seats} onChange={e=>setSeats(Number(e.target.value))}/>
          </label>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">Update</button>
        </section>
        <section className="bg-[#111418] rounded-2xl p-6 border border-white/5">
          <div className="font-semibold mb-2">Invoices</div>
          <div className="rounded border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">#</th><th className="p-2">Date</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
              <tbody>{invoices.map(i=><tr key={i.id} className="border-b border-white/5"><td className="p-2">{i.id}</td><td className="p-2">{i.date}</td><td className="p-2">{i.amount}</td><td className="p-2">{i.status}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
