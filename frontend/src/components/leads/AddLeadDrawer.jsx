// src/components/leads/AddLeadDrawer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLeadsApi from "@/hooks/useLeadsApi";
import useCountriesApi from "@/hooks/useCountriesApi";

/** Turn "IN" -> 🇮🇳 (emoji flag fallback if DB doesn’t provide one) */
const flagFromIso2 = (iso2 = "") =>
  iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));

/** Robustly normalize "maybe-array" into a real array */
function normalizeToArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.data)) return maybe.data;
  if (Array.isArray(maybe?.rows)) return maybe.rows;
  if (Array.isArray(maybe?.results)) return maybe.results;
  return [];
}

/** Custom fields shape:
 *  [{ id,key,label,type,required,options?, group: 'general'|'advance' }, ...]
 */

const INIT = {
  name: "",
  mobile_country: "IN",
  mobile_code: "+91",
  mobile: "",
  email: "",
  expected_revenue: "",
  follow_up_date: "",
  profession: "",
  stage: "new",
  status: "new",
  source: "",
  // advance
  details: "",
};

export default function AddLeadDrawer({
  onClose,
  onSuccess,
  prefill,
  stages = ["new","prospect","proposal","negotiation","closed"],
  sources = ["Website","Referral","Ads","Outbound","Event"],
  customFields = [],
  variant = "full", // kept for compatibility; we always show all fields
  onManageCustomFields,
  onCreateCustomField,
}) {
  const api = useLeadsApi();

  // countries from DB (normalize to array)
  const _c = useCountriesApi("en");
const countriesLoading = _c?.loading ?? false;
const countriesRaw = _c?.countries ?? _c ?? [];
  const countries = useMemo(() => normalizeToArray(countriesRaw), [countriesRaw]);
  const countryOpts = useMemo(() => {
    if (!countries.length) return [];
    return countries
      .map((c) => ({
        cc: (c.iso2 || c.cc || c.code || "").toUpperCase(),
        code: c.default_dial || c.dial || c.phone_code || "",
        label: `${c.emoji_flag || c.flag || flagFromIso2(c.iso2 || c.cc || "")} ${(c.iso2 || c.cc || "").toUpperCase()}`,
      }))
      .filter(o => o.cc && o.code);
  }, [countries]);

  // form state
  const [form, setForm] = useState(INIT);
  const [custom, setCustom] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dupMobile, setDupMobile] = useState(null);

  // local custom fields
  const [cfList, setCfList] = useState([]);
  const [showCFModal, setShowCFModal] = useState(false);

  // refs
  const firstInputRef = useRef(null);
  const submittingRef = useRef(false);

  // dial code map from DB
  const codeByCc = useMemo(
    () => Object.fromEntries(countryOpts.map((c) => [String(c.cc).toUpperCase(), c.code])),
    [countryOpts]
  );

  // hard reset on mount
  useEffect(() => {
    setForm({ ...INIT, ...(prefill || {}) });
    setCustom({});
    setCfList(
      (Array.isArray(customFields) ? customFields : []).map((f) => ({
        ...f,
        group: f?.group === "advance" ? "advance" : "general",
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // sync dial code once countries arrive
  useEffect(() => {
    if (countriesLoading) return;
    const hasOpts = countryOpts.length > 0;
    setForm((f) => {
      let cc = (f.mobile_country || "").toUpperCase();
      if (!hasOpts) return f;
      if (!cc || !codeByCc[cc]) cc = countryOpts[0].cc.toUpperCase();
      const code = codeByCc[cc] || "";
      if (f.mobile_country === cc && f.mobile_code === code) return f;
      return { ...f, mobile_country: cc, mobile_code: code };
    });
  }, [countriesLoading, countryOpts, codeByCc]);

  // lock body scroll, esc to close, focus first
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onEsc);
    const t = setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
      clearTimeout(t);
    };
  }, [onClose]);

  // helpers
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }));
  const updateFileCF = (key) => (e) =>
    setCustom((s) => ({ ...s, [key]: e.target.files?.[0] || null }));

  const onCountryChange = (e) => {
    const cc = (e.target.value || "").toUpperCase();
    setForm((f) => ({
      ...f,
      mobile_country: cc,
      mobile_code: codeByCc[cc] || "",
    }));
  };

  // duplicate mobile check (debounced)
  useEffect(() => {
    let alive = true;
    if (!String(form.mobile || "").trim()) {
      setDupMobile(null);
      return;
    }
    const timer = setTimeout(async () => {
      if (!api?.checkMobile) return;
      try {
        const res = await api.checkMobile({
          mobile: `${form.mobile_code} ${String(form.mobile).trim()}`,
        });
        if (alive) setDupMobile(!!res?.exists);
      } catch {
        if (alive) setDupMobile(null);
      }
    }, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [form.mobile, form.mobile_code, api]);

  // ---- GROUPED CUSTOM FIELDS ----
  const { generalCF, advanceCF } = useMemo(() => {
    const g = [], a = [];
    for (const f of cfList) (f.group === "advance" ? a : g).push(f);
    return { generalCF: g, advanceCF: a };
  }, [cfList]);

  // validation
  const problems = useMemo(() => {
    const p = {};
    const need = (k, msg) => { if (!String(form[k] ?? "").trim()) p[k] = msg; };

    need("name", "Lead name is required");
    need("mobile", "Mobile is required");
    need("follow_up_date", "Follow-up date is required");
    need("stage", "Lead stage is required");
    need("source", "Source is required");

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) p.email = "Invalid email";
    if (form.mobile && !/^[0-9\-()+\s]{6,20}$/.test(form.mobile)) p.mobile = "Invalid phone number";
    if (dupMobile) p.mobile = "Duplicate number — will be sent for approval";

    for (const cf of cfList) {
      if (!cf.required) continue;
      const v = custom?.[cf.key];
      if (cf.type === "checkbox") {
        if (!v) p[`cf:${cf.key}`] = `${cf.label} is required`;
      } else if (cf.type === "file") {
        if (!v) p[`cf:${cf.key}`] = `${cf.label} is required`;
      } else if (v === undefined || v === null || v === "") {
        p[`cf:${cf.key}`] = `${cf.label} is required`;
      }
    }
    return p;
  }, [form, custom, cfList, dupMobile]);

  const isValid = Object.keys(problems).length === 0;

  // payload builder (separates file-type custom fields into multipart parts)
  function buildPayload() {
    const customForJson = {};
    const files = {};

    for (const cf of cfList) {
      const key = cf.key;
      const v = custom[key];
      if (cf.type === "file") {
        if (v instanceof File) files[`cf_files[${key}]`] = v; // adjust name if your API differs
      } else {
        if (v !== undefined) customForJson[key] = v;
      }
    }

    const base = {
      name: String(form.name || "").trim(),
      mobile: `${form.mobile_code} ${String(form.mobile || "").trim()}`,
      email: form.email?.trim() || null,
      expected_revenue:
        form.expected_revenue !== "" && form.expected_revenue !== null
          ? Number(form.expected_revenue)
          : null,
      follow_up_date: form.follow_up_date,
      profession: form.profession || null,
      stage: form.stage,
      status: form.status || "new",
      source: form.source,
      details: form.details || null,
      custom_fields: customForJson,
    };

    const hasFiles = Object.keys(files).length > 0;
    return { base, files, hasFiles };
  }

  const submit = async (e) => {
    e?.preventDefault?.();
    if (submittingRef.current) return;
    setError("");

    if (!isValid) {
      setError("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    submittingRef.current = true;
    try {
      const { base, files, hasFiles } = buildPayload();
      let created;

      if (hasFiles && api.createLeadMultipart) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(base)) {
          fd.append(k, typeof v === "object" ? JSON.stringify(v) : v ?? "");
        }
        for (const [k, f] of Object.entries(files)) {
          if (f) fd.append(k, f);
        }
        created = await api.createLeadMultipart(fd);
      } else {
        created = await api.createLead(base);
      }

      const btn = document.getElementById("addlead-save");
      if (btn) { btn.classList.add("success-pulse"); setTimeout(() => onSuccess?.(created), 220); }
      else onSuccess?.(created);
    } catch (err) {
      console.error(err);
      setError("Failed to create lead. Please try again.");
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  // custom field renderer (supports file)
  const renderCF = (cf) => {
    const key = cf.key;
    const val = custom[key] ?? (cf.type === "checkbox" ? false : "");
    const set = (v) => setCustom((s) => ({ ...s, [key]: v }));
    const base = "gg-input w-full";
    const req = cf.required && <span className="text-rose-400">*</span>;

    const wrap = (control) => (
      <div key={cf.id || key}>
        {cf.type !== "checkbox" && (
          <label className="block text-sm gg-muted mb-1">
            {cf.label} {req}
          </label>
        )}
        {control}
        {problems[`cf:${key}`] && (
          <div className="text-rose-400 text-xs mt-1">
            {problems[`cf:${key}`]}
          </div>
        )}
      </div>
    );

    switch (cf.type) {
      case "textarea":
        return wrap(
          <textarea className={`${base} h-24`} value={val} onChange={(e) => set(e.target.value)} />
        );
      case "number":
        return wrap(
          <input type="number" className={base} value={val} onChange={(e) => set(e.target.value)} />
        );
      case "date":
        return wrap(
          <input type="date" className={base} value={val} onChange={(e) => set(e.target.value)} />
        );
      case "select":
        return wrap(
          <select className={base} value={val} onChange={(e) => set(e.target.value)}>
            <option value="">Select…</option>
            {(cf.options || []).map((opt) => (
              <option key={String(opt)} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label key={cf.id || key} className="flex items-center gap-2">
            <input type="checkbox" checked={!!val} onChange={(e) => set(e.target.checked)} />
            <span className="text-sm">{cf.label} {req}</span>
          </label>
        );
      case "file":
        return wrap(
          <>
            <input type="file" className={base} accept={cf.accept || "*/*"} onChange={updateFileCF(key)} />
            {val instanceof File && (
              <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Selected: {val.name}
              </div>
            )}
          </>
        );
      default:
        return wrap(<input className={base} value={val} onChange={(e) => set(e.target.value)} />);
    }
  };

  // ====== CORE FIELDS ======
  const coreTop = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="block text-sm gg-muted mb-1">
          Lead Name <span className="text-rose-400">*</span>
        </label>
        <input
          ref={firstInputRef}
          className="gg-input w-full"
          value={form.name}
          onChange={update("name")}
          placeholder="Lead name"
          aria-invalid={!!problems.name}
        />
        {problems.name && <div className="text-rose-400 text-xs mt-1">{problems.name}</div>}
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">
          Mobile <span className="text-rose-400">*</span>
        </label>
        <div className="flex gap-2">
          <select
            className="gg-input w-28"
            value={form.mobile_country}
            onChange={onCountryChange}
            aria-label="Country"
            disabled={countriesLoading || !countryOpts.length}
          >
            {countryOpts.map((c) => (
              <option key={c.cc} value={c.cc}>{c.label} {c.code}</option>
            ))}
          </select>
          <input readOnly className="gg-input w-20 text-center" value={form.mobile_code} aria-label="Dial code" />
          <input
            className="gg-input flex-1"
            value={form.mobile}
            onChange={update("mobile")}
            placeholder="Enter mobile number"
            aria-invalid={!!problems.mobile}
          />
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          {dupMobile === true ? "Duplicate Mobile Number will be sent for approval." : "We'll check duplicates automatically."}
        </div>
        {problems.mobile && <div className="text-rose-400 text-xs mt-1">{problems.mobile}</div>}
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">Email</label>
        <input
          className="gg-input w-full"
          value={form.email}
          onChange={update("email")}
          placeholder="you@company.com"
          aria-invalid={!!problems.email}
        />
        {problems.email && <div className="text-rose-400 text-xs mt-1">{problems.email}</div>}
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">Expected Revenue</label>
        <input
          type="number"
          inputMode="decimal"
          className="gg-input w-full"
          value={form.expected_revenue}
          onChange={update("expected_revenue")}
          placeholder="Revenue"
        />
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">
          Follow Up Date <span className="text-rose-400">*</span>
        </label>
        <input
          type="date"
          className="gg-input w-full"
          value={form.follow_up_date}
          onChange={update("follow_up_date")}
          aria-invalid={!!problems.follow_up_date}
        />
        {problems.follow_up_date && <div className="text-rose-400 text-xs mt-1">{problems.follow_up_date}</div>}
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">Profession</label>
        <input className="gg-input w-full" value={form.profession} onChange={update("profession")} placeholder="Profession" />
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">
          Lead Stage <span className="text-rose-400">*</span>
        </label>
        <select className="gg-input w-full" value={form.stage} onChange={update("stage")} aria-invalid={!!problems.stage}>
          {stages.map((s) => (<option key={s} value={s}>{cap(s)}</option>))}
        </select>
        {problems.stage && <div className="text-rose-400 text-xs mt-1">{problems.stage}</div>}
      </div>

      <div>
        <label className="block text-sm gg-muted mb-1">
          Source <span className="text-rose-400">*</span>
        </label>
        <select className="gg-input w-full" value={form.source} onChange={update("source")} aria-invalid={!!problems.source}>
          <option value="">Select a Source</option>
          {sources.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        {problems.source && <div className="text-rose-400 text-xs mt-1">{problems.source}</div>}
      </div>
    </div>
  );

  // ====== GROUP SECTIONS ======
  const generalGroup = (
    <section className="gg-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">General</div>
        {/* Removed the "+ Add custom field" button here */}
      </div>

      {coreTop}

      {/* Show General custom fields only if there are any; no empty state, no add CTA */}
      {generalCF.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">Custom fields — General</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {generalCF.map(renderCF)}
          </div>
        </div>
      )}
    </section>
  );

  const advanceGroup = (
    <section className="gg-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Advance</div>
        <button
          type="button"
          className="gg-btn"
          onClick={() => onManageCustomFields ? onManageCustomFields() : setShowCFModal(true)}
        >
          Manage / Add custom fields
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm gg-muted mb-1">Detailed information</label>
          <textarea className="gg-input w-full h-24" value={form.details} onChange={update("details")} placeholder="Notes or context" />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Custom fields — Advance</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {advanceCF.length > 0 ? (
            advanceCF.map(renderCF)
          ) : (
            <EmptyCustomGroup onAdd={() => onManageCustomFields ? onManageCustomFields() : setShowCFModal(true)} />
          )}
        </div>
      </div>
    </section>
  );

  const el = (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-fadeIn" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[720px]
                    bg-[var(--surface)] border-l border-[color:var(--border)] shadow-2xl
                    animate-slideIn will-change-transform"
        role="dialog" aria-modal="true" aria-label="Add Lead"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
          <div>
            <h2 className="text-lg font-semibold">New Lead</h2>
            <div className="gg-muted text-xs">All fields</div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-4 space-y-4 overflow-auto h-[calc(100%-56px-64px)]">
          {generalGroup}
          {advanceGroup}

          {error && (
            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[color:var(--border)]">
          <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button
            id="addlead-save"
            className="gg-btn gg-btn-primary"
            type="submit"
            onClick={submit}
            disabled={saving || !isValid}
            aria-disabled={saving || !isValid}
          >
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </aside>

      {/* Inline Custom Field Modal (still available via Advance group button) */}
      {showCFModal && (
        <CFModal
          onClose={() => setShowCFModal(false)}
          onSave={async (field) => {
            let newField = { ...field, group: field.group === "advance" ? "advance" : "general" };
            if (onCreateCustomField) {
              try {
                const persisted = await onCreateCustomField(newField);
                if (persisted) newField = { ...newField, ...persisted };
              } catch {}
            }
            setCfList((list) => [...list, newField]);
            setShowCFModal(false);
          }}
        />
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn {
          0% { transform: translateX(28px); opacity: .0; }
          60% { transform: translateX(-3px); opacity: 1; }
          100% { transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn .18s ease-out both; }
        .animate-slideIn { animation: slideIn .22s cubic-bezier(.2,.8,.2,1) both; }

        .success-pulse { position: relative; }
        .success-pulse::after{
          content:''; position:absolute; inset:-3px; border-radius:12px;
          box-shadow:0 0 0 0 var(--ring); animation:pulse .22s ease-out 1;
        }
        @keyframes pulse{ from{box-shadow:0 0 0 0 var(--ring);} to{box-shadow:0 0 0 12px rgba(0,0,0,0);} }
      `}</style>
    </div>
  );

  return createPortal(el, document.body);
}

function EmptyCustomGroup({ onAdd }) {
  return (
    <div className="gg-card flex items-center justify-between">
      <div className="text-sm text-[color:var(--muted)]">No custom fields yet.</div>
      <button type="button" className="gg-btn gg-btn-link" onClick={onAdd}>Add a custom field</button>
    </div>
  );
}

function CFModal({ onClose, onSave }) {
  const [f, setF] = useState({
    label: "",
    key: "",
    type: "text",
    group: "general",
    required: false,
    optionsText: "",
  });

  const save = () => {
    const key = (f.key || f.label).trim().toLowerCase().replace(/\s+/g, "_");
    if (!f.label.trim()) return;
    const field = {
      id: crypto.randomUUID(),
      label: f.label.trim(),
      key,
      type: f.type,
      group: f.group,
      required: !!f.required,
      options: f.type === "select"
        ? f.optionsText.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };
    onSave?.(field);
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 gg-panel p-4 rounded-2xl w-[520px] max-w-[92vw]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Add custom field</h3>
          <button className="gg-btn gg-btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="gg-label">Label *</label>
            <input className="gg-input" value={f.label} onChange={(e) => setF((s) => ({ ...s, label: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gg-label">Key</label>
              <input className="gg-input" value={f.key} onChange={(e) => setF((s) => ({ ...s, key: e.target.value }))} placeholder="auto from label if empty" />
            </div>
            <div>
              <label className="gg-label">Group</label>
              <select className="gg-input" value={f.group} onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}>
                <option value="general">General</option>
                <option value="advance">Advance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gg-label">Type</label>
              <select className="gg-input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="textarea">Textarea</option>
                <option value="select">Select</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
                <option value="file">File</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="gg-checkbox" checked={f.required} onChange={(e) => setF((s) => ({ ...s, required: e.target.checked }))} />
                Required
              </label>
            </div>
          </div>

          {f.type === "select" && (
            <div>
              <label className="gg-label">Options (comma separated)</label>
              <input className="gg-input" placeholder="e.g., Hot, Warm, Cold" value={f.optionsText} onChange={(e) => setF((s) => ({ ...s, optionsText: e.target.value }))} />
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4 gap-2">
          <button className="gg-btn gg-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="gg-btn gg-btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function cap(s){ return String(s||"").charAt(0).toUpperCase() + String(s||"").slice(1); }
