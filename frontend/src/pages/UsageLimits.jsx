import React from "react";
export default function UsageLimits(){
  const rows = [
    { name:"API requests", used: 42000, limit: 100000 },
    { name:"File storage (GB)", used: 120, limit: 500 },
    { name:"Emails/month", used: 3800, limit: 5000 },
  ];
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Usage & Limits</div><h1 className="text-2xl md:text-3xl font-bold">Usage & Limits</h1></div>
      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">Metric</th><th className="p-2">Used</th><th className="p-2">Limit</th><th className="p-2">%</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>{
              const pct = Math.round((r.used/r.limit)*100);
              return (
                <tr key={i} className="border-b border-white/5">
                  <td className="p-2">{r.name}</td><td className="p-2">{r.used.toLocaleString()}</td><td className="p-2">{r.limit.toLocaleString()}</td>
                  <td className="p-2">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
