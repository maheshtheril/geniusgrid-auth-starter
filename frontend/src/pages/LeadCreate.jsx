// src/components/leads/AddLeadDrawer.jsx — refined UI + robust backend payload
// - Phone input takes max width; country dropdown & dial code are compact
// - Backend hardening: E.164-ish phone, stringified custom_fields in FormData/JSON
// - Include company_id when available (multi-tenant safety)
// - Surfaces server error message to the user

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Phone, Mail, CalendarDays, User2, Flag, Plus, Info } from "lucide-react";
import useLeadsApi from "@/hooks/useLeadsApi";
import useCountriesApi from "@/hooks/useCountriesApi";
import "flag-icons/css/flag-icons.min.css"; // SVG flags

const safeRandomId = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

/** Turn "IN" -> 🇮🇳 (emoji fallback if DB doesn’t provide one) */
const flagFromIso2 = (iso2 = "") => iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

/** Normalize "maybe-array" into a real array */
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
};

/* --------------------------------- UI Primitives --------------------------------- */
function Section({ title, subtitle, children, right }) {
  return (
    <section className="gg-panel rounded-2xl p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base md:text-lg font-semibold leading-tight">{title}</div>
          {subtitle && <p className="gg-muted text-xs md:text-sm mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, htmlFor, children, hint, error }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-xs md:text-sm gg-muted">
          {label}
          {required && <span className="text-rose-400">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs" style={{ color: "var(--muted)" }}>{hint}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function Input({ id, value, onChange, placeholder, type = "text", invalid }) {
  return (
    <input
      id={id}
      type={type}
      className={`gg-input w-full h-10 md:h-11 ${invalid ? "ring-1 ring-rose-400/60" : ""}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-invalid={!!invalid}
    />
  );
}

function Select({ id, value, onChange, children, invalid }) {
  return (
    <select
      id={id}
      className={`gg-input w-full h-10 md:h-11 ${invalid ? "ring-1 ring-rose-400/60" : ""}`}
      value={value}
      onChange={onChange}
      aria-invalid={!!invalid}
    >
      {children}
    </select>
  );
}

/* ------------ CountrySelect (custom, with SVG flags) ------------ */
function CountrySelect({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const btnRef = useRef(null);

  const lower = (s) => String(s || "").toLowerCase();

  const selected = useMemo(() => options.find((o) => lower(o.cc) === lower(value)) || null, [options, value]);

  const filtered = useMemo(() => {
    const q = lower(query).trim();
    if (!q) return options;
    return options.filter(
      (o) => lower(o.name).includes(q) || lower(o.cc).includes(q) || String(o.code).replace("+", "").includes(q.replace("+", ""))
    );
  }, [options, query]);

  useEffect(() => {
    function onDoc(e) {
      if (!open) return;
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => { setHi(0); }, [query, open]);

  const choose = (cc) => {
    onChange?.(cc);
    setOpen(false);
    setQuery("");
    btnRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => {
          const input = boxRef.current?.querySelector("input[type='text']");
          input?.focus();
        }, 0);
      }
      return;
    }
    if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
  };

  const onListKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = filtered[hi]; if (o) choose(o.cc); }
  };

  return (
    <div className="relative" ref={boxRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        className={`gg-input h-10 md:h-11 w-20 sm:w-24 flex items-center gap-2 justify-between shrink-0 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 overflow-hidden">
          {selected ? (
            <>
              <span className={`fi fi-${selected.cc.toLowerCase()}`} aria-hidden />
              <span className="truncate text-sm font-medium">{selected.cc}</span>
            </>
          ) : (
            <span className="opacity-60">Country</span>
          )}
        </span>
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute z-[99999] mt-1 w-[22rem] max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[color:var(--border)] rounded-2xl shadow-2xl p-2" role="dialog">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Flag className="w-4 h-4 opacity-70" />
            <input type="text" className="gg-input w-full h-10" placeholder="Search country or code" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onListKey} />
          </div>
          <ul role="listbox" className="max-h-64 overflow-auto" tabIndex={-1} onKeyDown={onListKey}>
            {filtered.map((o, idx) => (
              <li key={o.cc} role="option" aria-selected={o.cc === value} className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer ${idx === hi ? "bg-[color:var(--hover)]" : ""}`} onMouseEnter={() => setHi(idx)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o.cc)}>
                <span className={`fi fi-${o.cc.toLowerCase()}`} aria-hidden />
                <span className="truncate">{o.name}</span>
                <span className="ml-2 text-xs opacity-70">{o.cc}</span>
                <span className="ml-auto text-sm font-medium">{o.code}</span>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-2 text-sm opacity-70">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
/* ------------------------------- end CountrySelect ------------------------------- */

// Helpers
const normalizePhone = (code, number) => {
  const clean = String(number || "").replace(/\D/g, "");
  const cleanCode = String(code || "").trim();
  return `${cleanCode}${clean}`; // "+91" + digits
};

const getActiveCompanyId = () =>
  (globalThis?.BOOTSTRAP?.activeCompanyId) ||
  (globalThis?.__BOOTSTRAP?.activeCompanyId) ||
  localStorage.getItem("activeCompanyId") || null;

export default function AddLeadDrawer({
  onClose,
  onSuccess,
  prefill,
  stages = ["new", "prospect", "proposal", "negotiation", "closed"],
  sources = ["Website", "Referral", "Ads", "Outbound", "Event"],
  customFields = [],
  variant = "full",
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
      .map((c) => {
        const cc = String(c.iso2 || c.cc || c.code || "").toUpperCase();
        const code = c.default_dial || c.dial || c.phone_code || "";
        const name = c.name_en || c.name || c.translation || cc;
        return { cc, code, name, emoji: c.emoji_flag || c.flag || flagFromIso2(cc) };
      })
      .filter((o) => o.cc && o.code);
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
  const codeByCc = useMemo(() => Object.fromEntries(countryOpts.map((c) => [String(c.cc).toUpperCase(), c.code])), [countryOpts]);

  // hard reset on mount
  useEffect(() => {
    setForm({ ...INIT, ...(prefill || {}) });
    setCustom({});
    setCfList((Array.isArray(customFields) ? customFields : []).map((f) => ({ ...f, group: f?.group === "advance" ? "advance" : "general" })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const updateFileCF = (key) => (e) => setCustom((s) => ({ ...s, [key]: e.target.files?.[0] || null }));

  const onCountryPicked = (cc) => {
    const CC = String(cc || "").toUpperCase();
    setForm((f) => ({ ...f, mobile_country: CC, mobile_code: codeByCc[CC] || "" }));
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
        const res = await api.checkMobile({ mobile: `${form.mobile_code} ${String(form.mobile).trim()}` });
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

  // payload builder (multipart + json variants)
  function buildPayload() {
    const customForJson = {};
    const files = {};

    for (const cf of cfList) {
      const key = cf.key;
      const v = custom[key];
      if (cf.type === "file") {
        if (v instanceof File) files[`cf_files[${key}]`] = v;
      } else {
        if (v !== undefined) customForJson[key] = v;
      }
    }

    const company_id = getActiveCompanyId();

    const digitsOnly = String(form.mobile || "").replace(/\D/g, "");
    const e164 = normalizePhone(form.mobile_code, form.mobile);

    const base = {
      name: String(form.name || "").trim(),
      // keep multiple shapes for compatibility
      mobile: e164,
      phone: e164,
      mobile_code: form.mobile_code,
      mobile_number: digitsOnly,
      mobile_country: form.mobile_country,
      country_iso2: form.mobile_country,

      email: form.email?.trim() || null,
      expected_revenue: form.expected_revenue !== "" && form.expected_revenue !== null ? Number(form.expected_revenue) : null,
      follow_up_date: form.follow_up_date,
      profession: form.profession || null,
      stage: form.stage,
      status: form.status || "new",
      source: form.source,
      details: "", // keep key for backend compatibility
      company_id: company_id || undefined,
      // IMPORTANT: for FormData we will send custom_fields as a STRING below
      // to avoid backend parsers choking on [object Object]
    };

    // Build FormData
    const fd = new FormData();
    for (const [k, v] of Object.entries(base)) {
      if (v === undefined) continue;
      fd.append(k, typeof v === "object" ? JSON.stringify(v) : v ?? "");
    }
    fd.append("custom_fields", JSON.stringify(customForJson));
    for (const [k, f] of Object.entries(files)) {
      if (f) fd.append(k, f);
    }

    // JSON fallback payload (custom_fields stringified)
    const baseJson = { ...base, custom_fields: JSON.stringify(customForJson) };

    const hasFiles = Object.keys(files).length > 0;
    return { base, baseJson, fd, hasFiles };
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
      const { baseJson, fd } = buildPayload();
      let created;

      // Prefer multipart for compatibility (works with/without files)
      if (api.createLeadMultipart) {
        created = await api.createLeadMultipart(fd);
      } else {
        created = await api.createLead(baseJson);
      }

      const btn = document.getElementById("addlead-save");
      if (btn) { btn.classList.add("success-pulse"); setTimeout(() => onSuccess?.(created), 220); }
      else onSuccess?.(created);
    } catch (err) {
      const serverMsg = err?.response?.data?.message || (typeof err?.response?.data === "string" ? err.response.data : null);
      console.error("CreateLead error:", err?.response || err);
      setError(serverMsg || "Failed to create lead. Please try again.");
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
    const base = "gg-input w-full h-10 md:h-11";
    const reqMark = cf.required && <span className="text-rose-400">*</span>;

    const wrap = (control) => (
      <div key={cf.id || key} className="space-y-1.5">
        {cf.type !== "checkbox" && <label className="text-xs md:text-sm gg-muted">{cf.label} {reqMark}</label>}
        {control}
        {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-0.5">{problems[`cf:${key}`]}</div>}
      </div>
    );

    switch (cf.type) {
      case "textarea":
        return wrap(<textarea className={`${base} h-24`} value={val} onChange={(e) => set(e.target.value)} />);
      case "number":
        return wrap(<input type="number" className={base} value={val} onChange={(e) => set(e.target.value)} />);
      case "date":
        return wrap(<input type="date" className={base} value={val} onChange={(e) => set(e.target.value)} />);
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
            <span className="text-sm">{cf.label} {reqMark}</span>
          </label>
        );
      case "file":
        return wrap(
          <input type="file" className={base} accept={cf.accept || "*/*"} onChange={updateFileCF(key)} />
        );
      default:
        return wrap(
          <input className={base} value={val} onChange={(e) => set(e.target.value)} />
        );
    }
  };

  /* ============================== LAYOUT ============================== */
  const el = (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] animate-fadeIn" onClick={onClose} aria-hidden />

      {/* Drawer */}
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[780px] bg-[var(--surface)] border-l border-[color:var(--border)] shadow-2xl animate-slideIn will-change-transform flex flex-col"
        role="dialog" aria-modal="true" aria-label="Add Lead"
      >
        {/* Header */}
        <div className="px-4 md:px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl gg-surface flex items-center justify-center"><User2 className="w-4 h-4" /></div>
            <div>
              <h2 className="text-base md:text-lg font-semibold leading-tight">New Lead</h2>
              <div className="gg-muted text-xs">Fill in the details below</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-auto">
          <div className="p-4 md:p-5 pt-6 space-y-5">
            {/* GENERAL */}
            <Section title="General" subtitle="Core information to create the lead.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Lead Name" required htmlFor="lead-name" error={problems.name}>
                  <div className="relative">
                    <Input id="lead-name" value={form.name} onChange={update("name")} placeholder="e.g., Priya Sharma" invalid={!!problems.name} />
                    <User2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-60" />
                  </div>
                </Field>

                <Field label="Email" htmlFor="lead-email" error={problems.email}>
                  <div className="relative">
                    <Input id="lead-email" value={form.email} onChange={update("email")} placeholder="you@company.com" invalid={!!problems.email} />
                    <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-60" />
                  </div>
                </Field>

                <Field label="Mobile" required htmlFor="lead-mobile" hint={dupMobile === true ? undefined : "Duplicate numbers are checked automatically."} error={problems.mobile}>
                  <div className="flex gap-1.5 items-stretch">
                    <CountrySelect options={countryOpts} value={form.mobile_country} onChange={onCountryPicked} disabled={countriesLoading || !countryOpts.length} />
                    <input readOnly className="gg-input h-10 md:h-11 w-10 sm:w-12 text-center shrink-0" value={form.mobile_code} aria-label="Dial code" />
                    <div className="relative flex-1 min-w-0">
                      <Input id="lead-mobile" value={form.mobile} onChange={update("mobile")} placeholder="Enter mobile number" invalid={!!problems.mobile} />
                      <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-60" />
                    </div>
                  </div>
                  {dupMobile === true && (
                    <div className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">
                      <Info className="w-3 h-3" /> Duplicate number — will be sent for approval
                    </div>
                  )}
                </Field>

                <Field label="Expected Revenue" htmlFor="lead-revenue">
                  <Input id="lead-revenue" type="number" inputMode="decimal" value={form.expected_revenue} onChange={update("expected_revenue")} placeholder="e.g., 50000" />
                </Field>

                <Field label="Follow Up Date" required htmlFor="lead-follow" error={problems.follow_up_date}>
                  <div className="relative">
                    <Input id="lead-follow" type="date" value={form.follow_up_date} onChange={update("follow_up_date")} invalid={!!problems.follow_up_date} />
                    <CalendarDays className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-60" />
                  </div>
                </Field>

                <Field label="Profession" htmlFor="lead-profession">
                  <Input id="lead-profession" value={form.profession} onChange={update("profession")} placeholder="e.g., Architect" />
                </Field>

                <Field label="Lead Stage" required htmlFor="lead-stage" error={problems.stage}>
                  <Select id="lead-stage" value={form.stage} onChange={update("stage")} invalid={!!problems.stage}>
                    {stages.map((s) => (
                      <option key={s} value={s}>{cap(s)}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Source" required htmlFor="lead-source" error={problems.source}>
                  <Select id="lead-source" value={form.source} onChange={update("source")} invalid={!!problems.source}>
                    <option value="">Select a Source</option>
                    {sources.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              {generalCF.length > 0 && (
                <div className="pt-1">
                  <div className="text-sm font-medium mb-2">Custom fields — General</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{generalCF.map(renderCF)}</div>
                </div>
              )}
            </Section>

            {/* ADVANCE (only custom fields) */}
            <Section
              title="Custom fields — Advance"
              right={
                <button type="button" className="gg-btn gg-btn-sm" onClick={() => (onManageCustomFields ? onManageCustomFields() : setShowCFModal(true))}>
                  <Plus className="w-4 h-4 mr-1" /> Add custom field
                </button>
              }
            >
              {advanceCF.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{advanceCF.map(renderCF)}</div>
              ) : (
                <div className="gg-card p-3 text-sm text-[color:var(--muted)]">No custom fields yet.</div>
              )}
            </Section>

            {error && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">{error}</div>}
          </div>
        </form>

        {/* Footer */}
        <div className="px-4 md:px-5 py-3 border-t border-[color:var(--border)] flex items-center justify-between gap-3 sticky bottom-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-xs md:text-sm gg-muted">
            <CheckCircle2 className="w-4 h-4" />
            <span>Required fields marked with <span className="text-rose-400">*</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button id="addlead-save" className="gg-btn gg-btn-primary" type="submit" onClick={submit} disabled={saving || !isValid} aria-disabled={saving || !isValid}>
              {saving ? "Saving…" : "Save Lead"}
            </button>
          </div>
        </div>
      </aside>

      {/* Inline Custom Field Modal */}
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
        @keyframes slideIn { 0% { transform: translateX(28px); opacity: .0; } 60% { transform: translateX(-3px); opacity: 1; } 100% { transform: translateX(0); } }
        .animate-fadeIn { animation: fadeIn .18s ease-out both; }
        .animate-slideIn { animation: slideIn .22s cubic-bezier(.2,.8,.2,1) both; }
        .success-pulse { position: relative; }
        .success-pulse::after{ content:''; position:absolute; inset:-3px; border-radius:12px; box-shadow:0 0 0 0 var(--ring); animation:pulse .22s ease-out 1; }
        @keyframes pulse{ from{box-shadow:0 0 0 0 var(--ring);} to{box-shadow:0 0 0 12px rgba(0,0,0,0);} }
      `}</style>
    </div>
  );

  return createPortal(el, document.body);
}

function CFModal({ onClose, onSave }) {
  const [f, setF] = useState({ label: "", key: "", type: "text", group: "general", required: false, optionsText: "" });

  const save = () => {
    const key = (f.key || f.label).trim().toLowerCase().replace(/\s+/g, "_");
    if (!f.label.trim()) return;
    const field = {
      id: safeRandomId(),
      label: f.label.trim(),
      key,
      type: f.type,
      group: f.group,
      required: !!f.required,
      options: f.type === "select" ? f.optionsText.split(",").map((s) => s.trim()).filter(Boolean) : [],
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
            <input className="gg-input h-10" value={f.label} onChange={(e) => setF((s) => ({ ...s, label: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gg-label">Key</label>
              <input className="gg-input h-10" value={f.key} onChange={(e) => setF((s) => ({ ...s, key: e.target.value }))} placeholder="auto from label if empty" />
            </div>
            <div>
              <label className="gg-label">Group</label>
              <select className="gg-input h-10" value={f.group} onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}>
                <option value="general">General</option>
                <option value="advance">Advance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="gg-label">Type</label>
              <select className="gg-input h-10" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
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
              <input className="gg-input h-10" placeholder="e.g., Hot, Warm, Cold" value={f.optionsText} onChange={(e) => setF((s) => ({ ...s, optionsText: e.target.value }))} />
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

function cap(s) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }
