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

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const canSubmit = useMemo(() => form.name.trim().length >= 2, [form.name]);

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onCreate?.(form); // parent handles closing & navigation
  };

  return (
    <Modal
      open={open}
      title="New Company"
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Create"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Name<span className="text-red-400"> *</span></span>
          <input
            autoFocus
            required
            aria-invalid={touched && !canSubmit}
            className="h-9 rounded-lg border bg-background px-3"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Acme Pvt Ltd"
          />
          {touched && !canSubmit && (
            <span className="text-xs text-red-400">Please enter at least 2 characters.</span>
          )}
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Domain</span>
          <input
            className="h-9 rounded-lg border bg-background px-3"
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            placeholder="acme.com"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Industry</span>
          <input
            className="h-9 rounded-lg border bg-background px-3"
            value={form.industry}
            onChange={(e) => set("industry", e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Owner</span>
          <input
            className="h-9 rounded-lg border bg-background px-3"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">City</span>
          <input
            className="h-9 rounded-lg border bg-background px-3"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Country</span>
          <input
            className="h-9 rounded-lg border bg-background px-3"
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="IN"
          />
        </label>
      </div>
    </Modal>
  );
}
