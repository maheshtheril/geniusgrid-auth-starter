import React, { useState } from "react";
const uid = () => Math.random().toString(36).slice(2);

export default function PipelinesStages(){
  const [pipelines, setPipes] = useState([
    { id: uid(), name: "Sales", stages: ["Prospect","Qualified","Proposal","Won","Lost"] },
    { id: uid(), name: "Renewals", stages: ["Due","Negotiation","Renewed","Churned"] },
  ]);
  const addPipe = () => setPipes(p => [...p, { id: uid(), name: "New Pipeline", stages: ["Stage 1"] }]);
  const updName = (id, name) => setPipes(p => p.map(x => x.id===id ? {...x, name} : x));
  const addStage = (id) => setPipes(p => p.map(x => x.id===id ? {...x, stages:[...x.stages, `Stage ${x.stages.length+1}`]} : x));
  const delStage = (id, i) => setPipes(p => p.map(x => x.id===id ? {...x, stages:x.stages.filter((_,idx)=>idx!==i)} : x));

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-sm text-gray-400">Admin / Data & Customization / Pipelines & Stages</div>
        <h1 className="text-2xl md:text-3xl font-bold">Pipelines & Stages</h1>
      </div>

      <div className="space-y-4">
        {pipelines.map(p => (
          <div key={p.id} className="bg-[#111418] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <input className="bg-[#0B0D10] border border-white/10 rounded px-3 py-2"
                     value={p.name} onChange={e=>updName(p.id, e.target.value)} />
              <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={()=>addStage(p.id)}>+ Stage</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.stages.map((s,i)=>(
                <span key={i} className="inline-flex items-center gap-2 bg-white/5 rounded-full px-3 py-1 text-sm">
                  {s}
                  <button onClick={()=>delStage(p.id,i)} className="text-xs opacity-80 hover:opacity-100">✖</button>
                </span>
              ))}
            </div>
          </div>
        ))}
        <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addPipe}>+ Pipeline</button>
      </div>
    </div>
  );
}
