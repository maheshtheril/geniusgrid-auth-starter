import React, { useState } from "react";
export default function AiSettings(){
  const [cfg, setCfg] = useState({ provider:"openai", model:"gpt-4o-mini", temperature:0.3, redactPII:true });
  const up = (k,v)=>setCfg(p=>({...p,[k]:v}));
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / AI & Automation / AI Settings</div><h1 className="text-2xl md:text-3xl font-bold">AI Settings</h1></div>
      <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Provider</div>
            <select className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={cfg.provider} onChange={e=>up("provider",e.target.value)}>
              <option value="openai">OpenAI</option><option value="azure">Azure OpenAI</option><option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Model</div>
            <input className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={cfg.model} onChange={e=>up("model",e.target.value)}/>
          </label>
          <label className="block">
            <div className="text-xs text-gray-400 mb-1">Temperature</div>
            <input type="number" step="0.1" min="0" max="1" className="w-full bg-[#0B0D10] border border-white/10 rounded px-3 py-2" value={cfg.temperature} onChange={e=>up("temperature",Number(e.target.value))}/>
          </label>
        </div>
        <label className="flex items-center gap-2 bg-[#0B0D10] border border-white/10 rounded px-3 py-2">
          <input type="checkbox" checked={cfg.redactPII} onChange={e=>up("redactPII",e.target.checked)}/> Redact PII in logs
        </label>
        <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">Save</button>
      </section>
    </div>
  );
}
