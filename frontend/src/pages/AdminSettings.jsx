import React, { useState } from "react";

export default function AdminSettings() {
  const [cfg, setCfg] = useState({
    timezone: "Asia/Kolkata",
    currency: "INR",
    dateFormat: "DD/MM/YYYY",
    fiscalStart: "April",
  });
  const up = (k, v) => setCfg(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-sm text-gray-400">Admin / Data & Customization / Settings</div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Global data & localization defaults for your tenant.</p>
      </div>

      <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Timezone</div>
            <select className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-3 py-2"
                    value={cfg.timezone} onChange={e=>up("timezone", e.target.value)}>
              {["Asia/Kolkata","UTC","America/New_York","Europe/London","Asia/Singapore"].map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Currency</div>
            <select className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-3 py-2"
                    value={cfg.currency} onChange={e=>up("currency", e.target.value)}>
              {["INR","USD","EUR","GBP","AED","SGD"].map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Date format</div>
            <select className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-3 py-2"
                    value={cfg.dateFormat} onChange={e=>up("dateFormat", e.target.value)}>
              {["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].map(f => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Fiscal year starts</div>
            <select className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-3 py-2"
                    value={cfg.fiscalStart} onChange={e=>up("fiscalStart", e.target.value)}>
              {["January","April","July","October"].map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">Save</button>
      </section>
    </div>
  );
}
