// src/components/leads/AddLeadDrawer.jsx
import { useEffect, useRef, useState } from "react";
import useLeadsApi from "@/hooks/useLeadsApi";

export default function AddLeadDrawer({ onClose, onSuccess }) {
  const api = useLeadsApi();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const nameRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    status: "new",
    stage: "new",
    owner_name: "",
    score: "",
    notes: "",
  });

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", esc);
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => { document.removeEventListener("keydown", esc); clearTimeout(t); };
  }, [onClose]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Lead name is required.");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        score: form.score === "" ? undefined : Number(form.score),
      };
      const created = await api.createLead(payload);
      onSuccess?.(created);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create lead.");
    } finally {
      setSaving(false);
    }
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div className="gg-drawer" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="gg-drawer-panel" onClick={stop}>
        <header className="gg-drawer-header">
          <h3>Add Lead</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <form className="gg-drawer-body" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="grid gap-3">
            <label className="form-control">
              <span className="label-text">Lead Name *</span>
              <input ref={nameRef} className="input input-bordered" value={form.name} onChange={update("name")} placeholder="Ada Lovelace" />
            </label>

            <label className="form-control">
              <span className="label-text">Company</span>
              <input className="input input-bordered" value={form.company_name} onChange={update("company_name")} placeholder="Analytical Engines Ltd" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="form-control">
                <span className="label-text">Email</span>
                <input type="email" className="input input-bordered" value={form.email} onChange={update("email")} placeholder="ada@company.com" />
              </label>
              <label className="form-control">
                <span className="label-text">Phone</span>
                <input className="input input-bordered" value={form.phone} onChange={update("phone")} placeholder="+1 555 0199" />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="form-control">
                <span className="label-text">Status</span>
                <select className="select select-bordered" value={form.status} onChange={update("status")}>
                  <option value="new">new</option>
                  <option value="qualified">qualified</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
                </select>
              </label>

              <label className="form-control">
                <span className="label-text">Stage</span>
                <select className="select select-bordered" value={form.stage} onChange={update("stage")}>
                  <option value="new">new</option>
                  <option value="qualified">qualified</option>
                  <option value="proposal">proposal</option>
                  <option value="negotiation">negotiation</option>
                  <option value="won">won</option>
                  <option value="lost">lost</option>
                </select>
              </label>

              <label className="form-control">
                <span className="label-text">AI Score</span>
                <input type="number" className="input input-bordered" value={form.score} onChange={update("score")} placeholder="e.g. 72" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="form-control">
                <span className="label-text">Owner</span>
                <input className="input input-bordered" value={form.owner_name} onChange={update("owner_name")} placeholder="Owner name" />
              </label>
              <div className="hidden md:block" />
            </div>

            <label className="form-control">
              <span className="label-text">Notes</span>
              <textarea className="textarea textarea-bordered min-h-[96px]" value={form.notes} onChange={update("notes")} placeholder="Anything helpful for the team…" />
            </label>
          </div>

          <footer className="gg-drawer-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn btn-primary ${saving ? "loading" : ""}`} disabled={saving}>
              {saving ? "Saving…" : "Create Lead"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
