import React, { useState } from "react";
const makeKey = () => "gg_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export default function ApiKeysAdmin(){
  const [keys, setKeys] = useState([]);
  const create = () => setKeys(p => [{ label:"New Key", key: makeKey(), created: new Date().toLocaleString() }, ...p]);
  const revoke = (k) => setKeys(p => p.filter(x => x.key!==k));
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div><div className="text-sm text-gray-400">Admin / API Keys</div><h1 className="text-2xl md:text-3xl font-bold">API Keys</h1></div>
      <div className="bg-[#111418] rounded-2xl p-6 border border-white/5">
        <button className="mb-4 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={create}>+ Generate</button>
        <div className="rounded border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-white/10"><th className="p-2">Label</th><th className="p-2">Key</th><th className="p-2">Created</th><th className="p-2 w-28">Actions</th></tr></thead>
            <tbody>
              {keys.length===0 ? <tr><td className="p-3 text-gray-400" colSpan={4}>No keys.</td></tr> : keys.map(k=>(
                <tr key={k.key} className="border-b border-white/5">
                  <td className="p-2">{k.label}</td><td className="p-2"><code>{k.key}</code></td><td className="p-2">{k.created}</td>
                  <td className="p-2"><button className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5" onClick={()=>revoke(k.key)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
