// src/components/leads/AddLeadDrawer.jsx — production-ready
// - Phone input is max width; country dropdown is compact.
// - Clean sections. Title "Advance". No "Add custom field" button.
// - Custom fields are loaded from /api/custom-fields?entity=lead&record_type=lead.
// - Posts multipart/form-data with cfv[...] entries (no JSON map).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Phone, Mail, CalendarDays, User2, Flag, Info, X } from "lucide-react";
import useLeadsApi from "@/hooks/useLeadsApi";
import useCountriesApi from "@/hooks/useCountriesApi";
import { http } from "@/lib/http";
import "flag-icons/css/flag-icons.min.css";

const flagFromIso2 = (iso2 = "") =>
  iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

function normalizeToArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.data)) return maybe.data;
  if (Array.isArray(maybe?.rows)) return maybe.rows;
  if (Array.isArray(maybe?.results)) return maybe.results;
  if (maybe && typeof maybe === "object" && "items" in maybe && Array.isArray(maybe.items)) return maybe.items;
  return [];
}

/* -------------------------- Base lead form shape -------------------------- */
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

/* --------------------------------- UI atoms -------------------------------- */
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

const Input = React.forwardRef(function Input(
  { id, value, onChange, placeholder, type = "text", invalid, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      id={id}
      type={type}
      className={`gg-input w-full h-10 md:h-11 ${invalid ? "ring-1 ring-rose-400/60" : ""}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-invalid={!!invalid}
      {...rest}
    />
  );
});

const Select = React.forwardRef(function Select(
  { id, value, onChange, children, invalid, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      id={id}
      className={`gg-input w-full h-10 md:h-11 ${invalid ? "ring-1 ring-rose-400/60" : ""}`}
      value={value}
      onChange={onChange}
      aria-invalid={!!invalid}
      {...rest}
    >
      {children}
    </select>
  );
});

/* ---------------------- CountrySelect (with SVG flags) --------------------- */
function CountrySelect({ options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const btnRef = useRef(null);

  const lower = (s) => String(s || "").toLowerCase();
  const selected = useMemo(
    () => options.find((o) => lower(o.cc) === lower(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = lower(query).trim();
    if (!q) return options;
    return options.filter(
      (o) =>
        lower(o.name).includes(q) ||
        lower(o.cc).includes(q) ||
        String(o.code).replace("+", "").includes(q.replace("+", ""))
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

  const choose = (cc) => { onChange?.(cc); setOpen(false); setQuery(""); btnRef.current?.focus(); };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault(); setOpen(true);
        setTimeout(() => boxRef.current?.querySelector("input[type='text']")?.focus(), 0);
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
        /* reduced width to give phone input more room */
        className={`gg-input h-10 md:h-11 w-16 sm:w-20 flex items-center gap-2 justify-between shrink-0 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
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
          ) : (<span className="opacity-60">CC</span>)}
        </span>
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute z-[99999] mt-1 w-[22rem] max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[color:var(--border)] rounded-2xl shadow-2xl p-2" role="dialog">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Flag className="w-4 h-4 opacity-70" />
            <input
              type="text"
              className="gg-input w-full h-10"
              placeholder="Search country or code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKey}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-auto" tabIndex={-1} onKeyDown={onListKey}>
            {filtered.map((o, idx) => (
              <li
                key={o.cc}
                role="option"
                aria-selected={o.cc === value}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer ${idx === hi ? "bg-[color:var(--hover)]" : ""}`}
                onMouseEnter={() => setHi(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o.cc)}
              >
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

/* ============================== AddLeadDrawer ============================== */
export default function AddLeadDrawer({
  onClose,
  onSuccess,
  prefill,
  stages = ["new", "prospect", "proposal", "negotiation", "closed"],
  sources = ["Website", "Referral", "Ads", "Outbound", "Event"],
  customFields = [],   // kept for compatibility, not used
  variant = "full",
}) {
  const api = useLeadsApi();

  // countries from DB
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
  const [serverErrors, setServerErrors] = useState(null);
  const [dupMobile, setDupMobile] = useState(null);
  const [conflict, setConflict] = useState(null); // {message, field, existing_id, existing_name}

  // local custom fields (loaded from API)
  const [cfList, setCfList] = useState([]);

  // refs
  const firstInputRef = useRef(null);
  const submittingRef = useRef(false);

  const codeByCc = useMemo(
    () => Object.fromEntries(countryOpts.map((c) => [String(c.cc).toUpperCase(), c.code])),
    [countryOpts]
  );

  // reset + load custom fields on mount
  useEffect(() => {
    setForm({ ...INIT, ...(prefill || {}) });
    setCustom({});
    (async () => {
      try {
        const resp = await http.get("/api/custom-fields", {
          params: { entity: "lead", record_type: "lead" },
        });
        const items = normalizeToArray(resp?.data);

        const mapped = items
          .filter((f) => f?.is_active !== false)
          .map((f) => {
            const type = f.field_type || f.type || "text";
            const options =
              Array.isArray(f.options_json)
                ? f.options_json.map((o) => (typeof o === "string" ? o : o?.label ?? o?.value ?? ""))
                : Array.isArray(f.options)
                  ? f.options
                  : [];
            const accept =
              (f.validation_json && f.validation_json.accept) || f.accept || undefined;
            const order = f.order_index ?? f.order ?? 0;
            return {
              id: f.id,
              key: f.code || f.key,
              label: f.label,
              type,
              required: !!(f.is_required ?? f.required),
              options,
              accept,
              order_index: order,
            };
          })
          .filter((f) => !!f.id && !!f.key && !!f.label)
          .sort(
            (a, b) =>
              (a.order_index ?? 0) - (b.order_index ?? 0) ||
              String(a.label).localeCompare(String(b.label))
          );

        setCfList(mapped);
      } catch (e) {
        console.error("Failed to load custom fields", e);
        setCfList([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync dial code when countries arrive
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

  const onCountryPicked = (cc) => {
    const CC = String(cc || "").toUpperCase();
    setForm((f) => ({ ...f, mobile_country: CC, mobile_code: codeByCc[CC] || "" }));
  };

  // duplicate mobile check (debounced) — normalize as "+CC local" (with a space)
  useEffect(() => {
    let alive = true;
    if (!String(form.mobile || "").trim()) {
      setDupMobile(null);
      setConflict(null);
      return;
    }
    const timer = setTimeout(async () => {
      if (!api?.checkMobile) return;
      try {
        const code  = String(form.mobile_code || "").replace(/\s+/g, "");
        const local = String(form.mobile || "").replace(/\D+/g, "");
        const mobile = `${code} ${local}`;
        const res = await api.checkMobile({ mobile });
        if (!alive) return;
        const exists = !!res?.exists;
        setDupMobile(exists);
        if (exists && !conflict) {
          setConflict({
            message: "A lead with this mobile number already exists.",
            field: "mobile",
            existing_id: res?.id || res?.lead_id || null,
            existing_name: res?.name || null,
          });
        }
      } catch {
        if (alive) setDupMobile(null);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mobile, form.mobile_code, api]);

  // group all CFs under "Advance"
  const { advanceCF } = useMemo(() => {
    const a = [...cfList];
    return { advanceCF: a };
  }, [cfList]);

  // validation (client-side)
  const problems = useMemo(() => {
    const p = {};
    const need = (k, msg) => {
      if (!String(form[k] ?? "").trim()) p[k] = msg;
    };

    need("name", "Lead name is required");
    need("mobile", "Mobile is required");
    need("follow_up_date", "Follow-up date is required");
    need("stage", "Lead stage is required");
    need("source", "Source is required");

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      p.email = "Invalid email";
    if (form.mobile && !/^[0-9\-()+\s]{6,20}$/.test(form.mobile))
      p.mobile = "Invalid phone number";
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

  /* ---------------------- Build multipart FormData ---------------------- */
  function buildFormData(extra = {}) {
    const fd = new FormData();

    // Normalize phone: "+91 9999999999" (space)
    const code   = String(form.mobile_code || "").replace(/\s+/g, "");
    const local  = String(form.mobile || "").replace(/\D+/g, "");
    const mobile = `${code} ${local}`;
    const follow = form.follow_up_date ? String(form.follow_up_date).slice(0, 10) : "";
    const revenue =
      form.expected_revenue !== "" && form.expected_revenue !== null && !Number.isNaN(+form.expected_revenue)
        ? String(+form.expected_revenue)
        : "";

    const base = {
      name: String(form.name || "").trim(),
      mobile,
      email: form.email?.trim() || "",
      expected_revenue: revenue,
      follow_up_date: follow,
      profession: form.profession || "",
      stage: form.stage,
      status: form.status || "new",
      source: form.source,
      ...extra,
    };

    Object.entries(base).forEach(([k, v]) => fd.append(k, v ?? ""));

    // encode custom fields into cfv[i][field_id] + value_*
    let i = 0;
    for (const cf of cfList) {
      const key = cf.key;
      const v = custom[key];
      if (v == null || v === "") continue;

      const idx = i++;
      fd.append(`cfv[${idx}][field_id]`, cf.id);

      switch (cf.type) {
        case "number": {
          const num = (v === "" || v === null) ? "" : String(+v);
          fd.append(`cfv[${idx}][value_number]`, num);
          break;
        }
        case "date": {
          const d = String(v).slice(0, 10);
          fd.append(`cfv[${idx}][value_date]`, d);
          break;
        }
        case "file": {
          if (v instanceof File) {
            fd.append(`cfv[${idx}][file]`, v);
          }
          break;
        }
        case "checkbox": {
          fd.append(`cfv[${idx}][value_text]`, v ? "true" : "false");
          break;
        }
        case "select":
        case "textarea":
        case "text":
        default: {
          fd.append(`cfv[${idx}][value_text]`, String(v));
          break;
        }
      }
    }

    return fd;
  }

  async function postFormData(fd, config) {
    if (api?.createLeadMultipart) {
      try { return await api.createLeadMultipart(fd, config); } catch {}
      return await api.createLeadMultipart(fd);
    }
    // Fallback must hit /api since http baseURL is origin-only
    return http.post("/api/leads", fd, config);
  }

  /* ------------------------------- Submit -------------------------------- */
  const submit = async (e) => {
    e?.preventDefault?.();
    if (submittingRef.current) return;
    setError("");
    setServerErrors(null);
    setConflict(null);

    if (!isValid) {
      setError("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    submittingRef.current = true;
    try {
      const fd = buildFormData();
      const created = await postFormData(fd);

      const btn = document.getElementById("addlead-save");
      if (btn) {
        btn.classList.add("success-pulse");
        setTimeout(() => onSuccess?.(created), 220);
      } else onSuccess?.(created);
    } catch (err) {
      console.error("POST /leads failed:", err?.response || err);
      const status = err?.response?.status;
      const data = err?.response?.data || {};
      const msg =
        (typeof data === "string" && data) ||
        data?.message ||
        data?.error ||
        "Server error while creating lead.";

      if (status === 409) {
        const field = (data?.field || "").toString().toLowerCase();
        if (field === "mobile" || /mobile|phone/i.test(msg)) setDupMobile(true);
        setConflict({
          message: msg,
          field,
          existing_id: data?.existing_id || data?.id || null,
          existing_name: data?.existing_name || data?.name || null,
        });
        setError("");
      } else {
        setError(msg);
        setServerErrors(data?.errors || null);
      }
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  async function createAnyway() {
    setError("");
    setServerErrors(null);
    setSaving(true);
    try {
      const fd = buildFormData({ allow_duplicate: "1", force: "1" });
      const created = await postFormData(fd, { params: { allow_duplicate: 1, force: 1 } });

      const btn = document.getElementById("addlead-save");
      if (btn) {
        btn.classList.add("success-pulse");
        setTimeout(() => onSuccess?.(created), 220);
      } else onSuccess?.(created);
    } catch (err) {
      console.error("POST /leads (force) failed:", err?.response || err);
      const data = err?.response?.data;
      const status = err?.response?.status;
      const msg =
        (typeof data === "string" && data) ||
        data?.message ||
        data?.error ||
        `Server error${status ? ` (${status})` : ""}.`;
      setError(msg);
      setServerErrors(data?.errors || null);
    } finally {
      setSaving(false);
    }
  }

  // custom field renderer
  const renderCF = (cf) => {
    const key = cf.key;
    const val = custom[key] ?? (cf.type === "checkbox" ? false : "");
    const set = (v) => setCustom((s) => ({ ...s, [key]: v }));
    const base = "gg-input w-full h-10 md:h-11";
    const reqMark = cf.required && <span className="text-rose-400">*</span>;

    const wrap = (control) => (
      <div key={cf.id || key} className="space-y-1.5">
        {cf.type !== "checkbox" && (
          <label className="text-xs md:text-sm gg-muted">
            {cf.label} {reqMark}
          </label>
        )}
        {control}
        {problems[`cf:${key}`] && (
          <div className="text-rose-400 text-xs mt-0.5">
            {problems[`cf:${key}`]}
          </div>
        )}
      </div>
    );

    switch (cf.type) {
      case "textarea":
        return wrap(
          <textarea
            className={`${base} h-24`}
            value={val}
            onChange={(e) => set(e.target.value)}
          />
        );
      case "number":
        return wrap(
          <input
            type="number"
            className={base}
            value={val}
            onChange={(e) => set(e.target.value)}
          />
        );
      case "date":
        return wrap(
          <input
            type="date"
            className={base}
            value={val}
            onChange={(e) => set(e.target.value)}
          />
        );
      case "select":
        return wrap(
          <select
            className={base}
            value={val}
            onChange={(e) => set(e.target.value)}
          >
            <option value="">Select…</option>
            {(cf.options || []).map((opt) => (
              <option key={String(opt)} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label key={cf.id || key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) => set(e.target.checked)}
            />
            <span className="text-sm">
              {cf.label} {reqMark}
            </span>
          </label>
        );
      case "file":
        return wrap(
          <input
            type="file"
            className={base}
            accept={cf.accept || "*/*"}
            onChange={updateFileCF(key)}
          />
        );
      default:
        return wrap(
          <input
            className={base}
            value={val}
            onChange={(e) => set(e.target.value)}
          />
        );
    }
  };

  /* ============================== Layout ============================== */
  const el = (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] animate-fadeIn" onClick={onClose} aria-hidden />
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[780px] bg-[var(--surface)] border-l border-[color:var(--border)] shadow-2xl animate-slideIn will-change-transform flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Add Lead"
      >
        <div className="px-4 md:px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl gg-surface flex items-center justify-center">
              <User2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-semibold leading-tight">New Lead</h2>
              <div className="gg-muted text-xs">Fill in the details below</div>
            </div>
          </div>
          <button
            type="button"
            className="gg-btn gg-btn-ghost"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* IMPORTANT: form id so footer submit works */}
        <form id="addlead-form" onSubmit={submit} className="flex-1 overflow-auto">
          <div className="p-4 md:p-5 pt-6 space-y-5">
            <Section title="General" subtitle="Core information to create the lead.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Lead Name" required htmlFor="lead-name" error={problems.name}>
                  <div className="relative">
                    <Input
                      ref={firstInputRef}
                      id="lead-name"
                      value={form.name}
                      onChange={update("name")}
                      placeholder="e.g., Priya Sharma"
                      invalid={!!problems.name}
                    />
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
                    <input readOnly className="gg-input h-10 md:h-11 w-12 sm:w-14 text-center shrink-0" value={form.mobile_code} aria-label="Dial code" />
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
                    <Input
                      id="lead-follow"
                      type="date"
                      value={form.follow_up_date}
                      onChange={update("follow_up_date")}
                      invalid={!!problems.follow_up_date}
                      inputMode="numeric"
                      pattern="\d{4}-\d{2}-\d{2}"
                      autoComplete="off"
                      placeholder="YYYY-MM-DD"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md"
                      aria-label="Open date picker"
                      onClick={() => document.getElementById("lead-follow")?.showPicker?.()}
                      tabIndex={-1}
                      style={{ background: "transparent" }}
                    >
                      <CalendarDays className="w-4 h-4 opacity-70" />
                    </button>
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
            </Section>

            <Section title="Advance">
              {advanceCF.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{advanceCF.map(renderCF)}</div>
              ) : (
                <div className="gg-card p-3 text-sm text-[color:var(--muted)]">
                  No custom fields yet.
                </div>
              )}
            </Section>

            {/* Conflict card */}
            {conflict && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-200 px-3 py-2 space-y-2">
                <div className="font-medium">Possible duplicate</div>
                <div className="text-sm">{conflict.message}</div>
                <div className="flex items-center gap-2">
                  {conflict.existing_id && (
                    <a
                      href={`/crm/leads/${conflict.existing_id}`}
                      className="gg-btn gg-btn-ghost gg-btn-sm"
                    >
                      View existing
                    </a>
                  )}
                  <button
                    type="button"
                    className="gg-btn gg-btn-primary gg-btn-sm"
                    onClick={createAnyway}
                  >
                    Create anyway (request approval)
                  </button>
                </div>
              </div>
            )}

            {/* Hidden submit to ensure Enter works anywhere in the form */}
            <button type="submit" className="hidden" />

            {error && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {serverErrors && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-300 text-xs px-3 py-2 space-y-1">
                {Object.entries(serverErrors).map(([k, v]) => (
                  <div key={k}><span className="font-medium">{k}:</span> {Array.isArray(v) ? v.join(", ") : String(v)}</div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="px-4 md:px-5 py-3 border-t border-[color:var(--border)] flex items-center justify-between gap-3 sticky bottom-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-xs md:text-sm gg-muted">
            <CheckCircle2 className="w-4 h-4" />
            <span>Required fields marked with <span className="text-rose-400">*</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button
              id="addlead-save"
              className="gg-btn gg-btn-primary"
              type="submit"
              form="addlead-form"
              disabled={saving || !isValid}
              aria-disabled={saving || !isValid}
            >
              {saving ? "Saving…" : "Save Lead"}
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        :root { --input-placeholder: #8b95a7; }
        [data-theme="dark"] {
          --muted: #9aa3b2;
          --elev: #151922;
          --border: #273043;
          --ring: rgba(56,189,248,.40);
          --input-placeholder: #8a95a6;
        }
        .gg-muted { color: var(--muted); }
        .gg-input,
        select.gg-input,
        textarea.gg-input {
          background: var(--elev);
          color: var(--text, #e6e9ef);
          border: 1px solid var(--border);
        }
        .gg-input::placeholder,
        textarea.gg-input::placeholder { color: var(--input-placeholder); opacity: 1; }
        .gg-input:focus-visible,
        select.gg-input:focus-visible,
        textarea.gg-input:focus-visible {
          border-color: var(--ring);
          box-shadow: 0 0 0 3px var(--ring);
        }
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

function cap(s) {
  return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
}
