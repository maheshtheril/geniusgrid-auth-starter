import React, { useEffect, useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function DuplicateBanner({ leadId, min = 0.5 }) {
  const api = useLeadsApi();
  const [dups, setDups] = useState([]);

  useEffect(() => { (async ()=>{
    const r = await api.findDupes(leadId, min);
    setDups(r?.items || []);
  })(); }, [leadId, min]);

  if (!dups.length) return null;

  return (
    <div className="rounded-md border bg-amber-500/10 border-amber-400/40 p-2">
      <div className="text-sm font-semibold mb-1">Possible duplicates</div>
      <ul className="text-sm space-y-1">
        {dups.map(d => (
          <li key={d.id} className="flex items-center justify-between gap-2">
            <span>{d.name} {d.email ? `• ${d.email}` : ""} {d.phone_norm ? `• ${d.phone_norm}` : ""}</span>
            <div className="flex gap-2">
              <button className="gg-btn gg-btn-ghost" onClick={() => api.resolveDup({ lead_id: leadId, dup_lead_id: d.id, disposition: "dismissed", similarity: d.sim })}>
                Dismiss
              </button>
              <button className="gg-btn" onClick={() => api.resolveDup({ lead_id: leadId, dup_lead_id: d.id, disposition: "merged", similarity: d.sim })}>
                Mark merged
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
