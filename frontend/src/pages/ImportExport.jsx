import React, { useState } from "react";
export default function ImportExport(){
  const [file, setFile] = useState(null);
  const [logs, setLogs] = useState([]);
  const addLog = (t) => setLogs(p=>[{ ts:new Date().toLocaleString(), t }, ...p]);
  const doImport = () => { if (!file) return; addLog(`Imported ${file.name}`); setFile(null); };
  const doExport = (what) => addLog(`Exported ${what}.csv`);
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / Data & Customization / Import / Export</div><h1 className="text-2xl md:text-3xl font-bold">Import / Export</h1></div>
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-3">
          <div className="font-semibold">Import CSV</div>
          <input type="file" accept=".csv" onChange={e=>setFile(e.target.files?.[0]||null)}/>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={doImport} disabled={!file}>Import</button>
        </section>
        <section className="bg-[#111418] rounded-2xl p-6 border border-white/5 space-y-3">
          <div className="font-semibold">Export</div>
          {["leads","deals","companies","contacts"].map(x=>(
            <button key={x} className="mr-2 mb-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={()=>doExport(x)}>{x}</button>
          ))}
        </section>
      </div>
      <section className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        <div className="font-semibold mb-2">Activity</div>
        {logs.length===0 ? <div className="text-sm text-gray-400">No activity yet.</div> :
          <ul className="text-sm space-y-1">{logs.map((l,i)=><li key={i} className="text-gray-300">• {l.ts} — {l.t}</li>)}</ul>}
      </section>
    </div>
  );
}
