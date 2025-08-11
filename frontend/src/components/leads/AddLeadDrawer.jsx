import { useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function AddLeadDrawer({ onClose, onSuccess }) {
  const api = useLeadsApi();
  const [form, setForm] = useState({
    name: "", company_name: "", owner_name: "",
    status: "new", stage: "new", score: 0
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const created = await api.createLead(form);
      onSuccess?.(created);
    } finally { setBusy(false); }
  };

  return (
    <div className="drawer fixed inset-0 bg-base-200/50 backdrop-blur flex">
      <div className="ml-auto w-full max-w-[560px] h-full bg-base-100 shadow-xl flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">Add Lead</div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="p-4 flex-1 overflow-auto grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-sm opacity-70">Lead Name</label>
            <input className="input w-full" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))}/>
          </div>
          <div>
            <label className="block text-sm opacity-70">Company</label>
            <input className="input w-full" value={form.company_name} onChange={e=>setForm(f=>({ ...f, company_name: e.target.value }))}/>
          </div>
          <div>
            <label className="block text-sm opacity-70">Owner</label>
            <input className="input w-full" value={form.owner_name} onChange={e=>setForm(f=>({ ...f, owner_name: e.target.value }))}/>
          </div>
          <div>
            <label className="block text-sm opacity-70">Status</label>
            <select className="select w-full" value={form.status} onChange={e=>setForm(f=>({ ...f, status: e.target.value }))}>
              <option value="new">new</option>
              <option value="qualified">qualified</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
          </div>
          <div>
            <label className="block text-sm opacity-70">Stage</label>
            <input className="input w-full" value={form.stage} onChange={e=>setForm(f=>({ ...f, stage: e.target.value }))}/>
          </div>
          <div>
            <label className="block text-sm opacity-70">AI Score</label>
            <input className="input w-full" type="number" value={form.score} onChange={e=>setForm(f=>({ ...f, score: Number(e.target.value||0) }))}/>
          </div>
        </div>

        <div className="p-3 border-t flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Lead"}</button>
        </div>
      </div>
    </div>
  );
}
