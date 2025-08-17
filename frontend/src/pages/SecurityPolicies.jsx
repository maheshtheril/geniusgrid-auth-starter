import React, { useEffect, useState } from "react";
const STORE_KEY = "security_policies_v1";
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);
const Input = (p) => <input {...p} className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className||"")} />;

export default function SecurityPolicies(){
  const [cfg, setCfg] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch{} }
    return {
      password_min: 12, require_upper: true, require_lower: true, require_number: true, require_special: true,
      session_timeout_mins: 60, idle_timeout_mins: 30,
      lockout_attempts: 10, lockout_window_mins: 15, lockout_duration_mins: 30,
      ip_allowlist: "", data_retention_days: 365, allow_export: true, allow_thirdparty_storage: false,
    };
  });
  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); },[cfg]);
  const up = (patch)=> setCfg(prev => ({...prev, ...patch}));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-sm text-gray-400">Admin / Security & Compliance / Security Policies</div>
        <h1 className="text-2xl md:text-3xl font-bold">Security Policies</h1>
        <p className="text-sm text-gray-400 mt-1">Password, session, IP, data retention and export rules.</p>
      </div>

      <Section title="Password Policy" desc="Apply strong defaults for all users.">
        <div className="grid md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <span className="text-sm w-40">Min length</span>
            <Input type="number" min={8} value={cfg.password_min} onChange={(e)=>up({password_min:Number(e.target.value)})}/>
          </label>
          {["require_upper","require_lower","require_number","require_special"].map(k=>(
            <label key={k} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
              <input type="checkbox" checked={cfg[k]} onChange={(e)=>up({[k]:e.target.checked})} />
              <span className="text-sm">{k.replace("require_","Require ")}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Sessions & Lockout">
        <div className="grid md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <span className="text-sm w-40">Session timeout (min)</span>
            <Input type="number" min={10} value={cfg.session_timeout_mins} onChange={(e)=>up({session_timeout_mins:Number(e.target.value)})}/>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <span className="text-sm w-40">Idle timeout (min)</span>
            <Input type="number" min={5} value={cfg.idle_timeout_mins} onChange={(e)=>up({idle_timeout_mins:Number(e.target.value)})}/>
          </label>
          <div className="md:col-span-3 grid md:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
              <span className="text-sm w-40">Lockout after attempts</span>
              <Input type="number" min={3} value={cfg.lockout_attempts} onChange={(e)=>up({lockout_attempts:Number(e.target.value)})}/>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
              <span className="text-sm w-40">Lockout window (min)</span>
              <Input type="number" min={5} value={cfg.lockout_window_mins} onChange={(e)=>up({lockout_window_mins:Number(e.target.value)})}/>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
              <span className="text-sm w-40">Lockout duration (min)</span>
              <Input type="number" min={5} value={cfg.lockout_duration_mins} onChange={(e)=>up({lockout_duration_mins:Number(e.target.value)})}/>
            </label>
          </div>
        </div>
      </Section>

      <Section title="Network & Data">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">IP allowlist (comma separated CIDRs)</span>
            <Input value={cfg.ip_allowlist} onChange={(e)=>up({ip_allowlist:e.target.value})} />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input type="checkbox" checked={cfg.allow_export} onChange={(e)=>up({allow_export:e.target.checked})} />
            <span className="text-sm">Allow data export</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input type="checkbox" checked={cfg.allow_thirdparty_storage} onChange={(e)=>up({allow_thirdparty_storage:e.target.checked})} />
            <span className="text-sm">Allow 3rd-party storage</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <span className="text-sm w-48">Data retention (days)</span>
            <Input type="number" min={0} value={cfg.data_retention_days} onChange={(e)=>up({data_retention_days:Number(e.target.value)})}/>
          </label>
        </div>
      </Section>
    </div>
  );
}
