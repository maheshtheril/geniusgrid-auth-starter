import React, { useEffect, useState } from "react";
const STORE_KEY = "permissions_matrix_v1";
const RESOURCES = ["leads","deals","companies","contacts","invoices","reports","settings","users"];
const ACTIONS   = ["read","create","update","delete","export","approve"];

const Section = ({ title, children, desc }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);

export default function PermissionsMatrix(){
  const [matrix, setMatrix] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch{} }
    const init = {}; RESOURCES.forEach(r => ACTIONS.forEach(a => { init[`${r}.${a}`] = a==="read"; }));
    return init;
  });
  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(matrix)); },[matrix]);

  const toggle = (k) => setMatrix(prev => ({ ...prev, [k]: !prev[k] }));
  const setRow = (r, val) => {
    setMatrix(prev => {
      const next = { ...prev };
      ACTIONS.forEach(a => { next[`${r}.${a}`] = val; });
      return next;
    });
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(matrix, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "permissions_matrix.json"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Access Control / Permissions Matrix</div>
          <h1 className="text-2xl md:text-3xl font-bold">Permissions Matrix</h1>
          <p className="text-sm text-gray-400 mt-1">Global baseline of resource permissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={exportJSON}>Export JSON</button>
        </div>
      </div>

      <Section title="Matrix" desc="Quick set entire row or toggle cells.">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-2 pr-4">Resource</th>
                <th className="py-2 pr-4">All</th>
                {ACTIONS.map(a => <th key={a} className="py-2 pr-4 capitalize">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map(r => (
                <tr key={r} className="border-b border-white/5">
                  <td className="py-2 pr-4 capitalize">{r}</td>
                  <td className="py-2 pr-4">
                    <button className="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/5 mr-2" onClick={()=>setRow(r,true)}>Allow all</button>
                    <button className="px-2 py-1 text-xs rounded border border-white/10 hover:bg-white/5" onClick={()=>setRow(r,false)}>Deny all</button>
                  </td>
                  {ACTIONS.map(a=>{
                    const k = `${r}.${a}`;
                    return (
                      <td key={k} className="py-2 pr-4">
                        <input type="checkbox" checked={!!matrix[k]} onChange={()=>toggle(k)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
