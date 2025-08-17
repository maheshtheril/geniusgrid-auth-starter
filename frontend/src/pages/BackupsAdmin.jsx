import React, { useState } from "react";
export default function BackupsAdmin(){
  const [schedule, setSchedule] = useState("daily");
  const [items, setItems] = useState([{ at:"2025-08-16 02:00", status:"ok" }]);
  const runNow = () => setItems(p => [{ at:new Date().toLocaleString(), status:"ok" }, ...p]);
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Data & Customization / Backups</div><h1 className="text-2xl md:text-3xl font-bold">Backups</h1></div>
      <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Schedule</div>
            <select className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={schedule} onChange={e=>setSchedule(e.target.value)}>
              <option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
            </select>
          </label>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={runNow}>Backup now</button>
        </div>
        <div className="rounded border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">When</th><th className="p-2">Status</th></tr></thead>
            <tbody>{items.map((b,i)=><tr key={i} className="border-b border-white/5"><td className="p-2">{b.at}</td><td className="p-2">{b.status}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
