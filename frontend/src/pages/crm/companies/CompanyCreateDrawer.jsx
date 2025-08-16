// ---------- FILE: src/pages/crm/companies/CompanyCreateDrawer.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../_shared/Modal";

export default function CompanyCreateDrawer({ open, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: "",
    owner: "",
    city: "",
    country: "IN",
  });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({ name: "", domain: "", industry: "", owner: "", city: "", country: "IN" });
      setTouched(false);
    }
  }, [open]);

  const canSubmit = useMemo(
    () => form.name.trim().length >= 2,
    [form.name]
  );

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onCreate?.(form);
  };

  // Pretty slug hint from name
  const slug = useMemo(() => {
    const base = (form.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return base || "company-id";
  }, [form.name]);

  return (
    <Modal
      open={open}
      title="New Company"
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Create"
      size="lg"
    >
      {/* Intro */}
      <p className="text-sm text-muted-foreground mb-4">
        Create a company account. You can add people, deals, and notes after saving.
      </p>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Name */}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Name <span className="text-rose-400">*</span></span>
          <input
            autoFocus
            className="h-9 rounded-lg border border-white/15 bg-[#0b0d10] px-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            placeholder="Acme Pvt Ltd"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={touched && !canSubmit}
          />
          <span className="text-[11px] text-muted-foreground">ID preview: <code>{slug}</code></span>
          {touched && !canSubmit && (
            <span className="text-xs text-rose-400">Please enter at least 2 characters.</span>
          )}
        </label>

        {/* Domain */}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Domain</span>
          <input
            className="h-9 rounded-lg border border-white/15 bg-[#0b0d10] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            placeholder="acme.com"
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
          />
        </label>

        {/* Industry */}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Industry</span>
          <input
            className="h-9 rounded-lg border border-white/15 bg-[#0b0d10] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            placeholder="Software"
            value={form.industry}
            onChange={(e) => set("industry", e.target.value)}
          />
        </label>

        {/* Owner */}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Owner</span>
          <input
            className="h-9 rounded-lg border border-white/15 bg-[#0b0d10] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            placeholder="Assignee"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
          />
        </label>

        {/* City */}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">City</span>
          <input
            className="h-9 rounded-lg border border-white/15 bg-[#0b0d10] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            placeholder="Mumbai"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </label>

        {/* Country */}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Country</span>
          <input
            className="h-9 rounded-lg border border-white/15 bg-[#0b0d10] px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            placeholder="IN"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </label>
      </div>

      {/* Help note */}
      <div className="mt-3 text-xs text-muted-foreground">
        You can edit these details later from the company overview.
      </div>
    </Modal>
  );
}
