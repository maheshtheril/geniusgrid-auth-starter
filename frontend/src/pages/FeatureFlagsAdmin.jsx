import React, { useState } from "react";
export default function FeatureFlagsAdmin(){
  const [flags, setFlags] = useState([
    { key:"new_pipeline_ui", name:"New Pipeline UI", on:true },
    { key:"ai_assist", name:"AI Assist", on:false },
  ]);
  const toggle = (k) => setFlags(p => p.map(f => f.key===k ? {...f, on:!f.on} : f));
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Feature Flags</div><h1 className="text-2xl md:text-3xl font-bold">Feature Flags</h1></div>
      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        {flags.map(f=>(
          <label key={f.key} className="flex items-center justify-between border-b border-white/10 py-3">
            <div className="mr-3">
              <div className="font-medium">{f.name}</div>
              <div className="text-xs text-gray-400">{f.key}</div>
            </div>
            <input type="checkbox" checked={f.on} onChange={()=>toggle(f.key)} />
          </label>
        ))}
      </div>
    </div>
  );
}
