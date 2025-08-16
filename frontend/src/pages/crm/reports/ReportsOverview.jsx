// src/pages/crm/reports/ReportsOverview.jsx
import React from "react";

const Card = ({ title, value, sub }) => (
  <div className="p-4 rounded-xl border bg-background">
    <div className="text-xs text-muted-foreground">{title}</div>
    <div className="text-2xl font-semibold">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

function Bar({ label, value, max }){
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span>₹{value.toLocaleString('en-IN')}</span></div>
      <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-2 bg-primary" style={{ width: pct + '%' }} /></div>
    </div>
  );
}

export default function ReportsOverview(){
  const metrics = { deals: 128, won: 34, revenue: 9200000, calls: 212, tasksDone: 148 };
  const barData = [
    { label: 'This Month', value: 3200000 },
    { label: 'Last Month', value: 2400000 },
    { label: '2 Months Ago', value: 1800000 },
  ];
  const max = Math.max(...barData.map(b=>b.value), 1);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card title="Open Deals" value={metrics.deals} />
        <Card title="Won (30d)" value={metrics.won} />
        <Card title="Revenue (30d)" value={`₹${metrics.revenue.toLocaleString('en-IN')}`} />
        <Card title="Calls (30d)" value={metrics.calls} sub={`${metrics.tasksDone} tasks done`} />
      </div>

      <div className="p-4 rounded-xl border bg-background space-y-3">
        <div className="font-medium">Revenue Trend</div>
        <div className="space-y-2">
          {barData.map(b => <Bar key={b.label} label={b.label} value={b.value} max={max} />)}
        </div>
      </div>

      <div className="p-4 rounded-xl border bg-background overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40"><tr>
            {['Period','Deals Won','Revenue','Avg Deal Size'].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
          </tr></thead>
          <tbody>
            {[
              { p:'2025-08', won:12, rev: 3200000 },
              { p:'2025-07', won:10, rev: 2400000 },
              { p:'2025-06', won:7, rev: 1800000 },
            ].map(r=> (
              <tr key={r.p} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.p}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.won}</td>
                <td className="px-3 py-2 whitespace-nowrap">₹{r.rev.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2 whitespace-nowrap">₹{Math.round(r.rev / r.won).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}