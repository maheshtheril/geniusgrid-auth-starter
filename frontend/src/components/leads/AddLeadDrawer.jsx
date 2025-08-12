import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLeadsApi from "@/hooks/useLeadsApi";

/** Custom fields shape (unchanged)
 *  [{ id,key,label,type,required,options? }, ...]
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
  headshot_file: null,
  meeting_photo_file: null,
  voice_record_file: null,
};

const COUNTRY_OPTS = [
  { cc: "IN", code: "+91",  label: "🇮🇳 IN" },
  { cc: "US", code: "+1",   label: "🇺🇸 US" },
  { cc: "GB", code: "+44",  label: "🇬🇧 UK" },
  { cc: "AE", code: "+971", label: "🇦🇪 AE" },
  { cc: "SG", code: "+65",  label: "🇸🇬 SG" },
];

export default function AddLeadDrawer({
  onClose,
  onSuccess,
  prefill,
  stages = ["new","prospect","proposal","negotiation","closed"],
  sources = ["Website","Referral","Ads","Outbound","Event"],
  customFields = [],
  variant = "quick", // "quick" | "full"
}) {
  const api = useLeadsApi();

  // form state
  const [form, setForm] = useState(INIT);
  const [custom, setCustom] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openAdvanced, setOpenAdvanced] = useState(true);
  const [mode, setMode] = useState(variant); // UI mode: quick or full
  const [dupMobile, setDupMobile] = useState(null);

  // refs
  const firstInputRef = useRef(null);

  // prepare country code map
  const codeByCc = useMemo(() => Object.fromEntries(COUNTRY_OPTS.map(c => [c.cc, c.code])), []);

  // hard reset on mount (prevents stale values on reopen)
  useEffect(() => {
    setForm({ ...INIT, ...(prefill || {}) });
    setCustom({});
    setMode(variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

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
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));
  const updateFile = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.files?.[0] || null }));

  const onCountryChange = (e) => {
    const cc = e.target.value;
    setForm(f => ({ ...f, mobile_country: cc, mobile_code: codeByCc[cc] || "" }));
  };

  // duplicate mobile check (debounced)
  useEffect(() => {
    let alive = true;
    if (!form.mobile.trim()) { setDupMobile(null); return; }
    const timer = setTimeout(async () => {
      if (!api?.checkMobile) return; // silently skip if not available
      try {
        const res = await api.checkMobile({ mobile: `${form.mobile_code} ${form.mobile.trim()}` });
        if (alive) setDupMobile(!!res?.exists);
      } catch { if (alive) setDupMobile(null); }
    }, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [form.mobile, form.mobile_code, api]);

  // validation
  const problems = useMemo(() => {
    const p = {};
    const need = (k, msg) => { if (!String(form[k] ?? "").trim()) p[k] = msg; };

    // required for both modes
    need("name", "Lead name is required");
    need("mobile", "Mobile is required");
    need("follow_up_date", "Follow-up date is required");
    need("stage", "Lead stage is required");
    need("source", "Source is required");

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) p.email = "Invalid email";
    if (form.mobile && !/^[0-9\-()+\s]{6,20}$/.test(form.mobile)) p.mobile = "Invalid phone number";
    if (dupMobile) p.mobile = "Mobile already exists (will be sent for approval)";

    // custom-field required
    for (const cf of customFields) {
      if (cf.required) {
        const v = custom?.[cf.key];
        if (cf.type === "checkbox") { if (!v) p[`cf:${cf.key}`] = `${cf.label} is required`; }
        else if (v === undefined || v === null || v === "") p[`cf:${cf.key}`] = `${cf.label} is required`;
      }
    }
    return p;
  }, [form, custom, customFields, dupMobile]);

  const isValid = Object.keys(problems).length === 0;

  // payload builder
  function buildPayload() {
    const base = {
      name: form.name.trim(),
      mobile: `${form.mobile_code} ${form.mobile.trim()}`,
      email: form.email.trim() || null,
      expected_revenue: form.expected_revenue ? Number(form.expected_revenue) : null,
      follow_up_date: form.follow_up_date,
      profession: form.profession || null,
      stage: form.stage,
      status: form.status || "new",
      source: form.source,
      details: form.details || null,
      custom_fields: custom,
    };
    const files = {
      headshot_file: form.headshot_file,
      meeting_photo_file: form.meeting_photo_file,
      voice_record_file: form.voice_record_file,
    };
    const hasFiles = !!(files.headshot_file || files.meeting_photo_file || files.voice_record_file);
    return { base, files, hasFiles };
  }

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!isValid) return setError("Please fix the highlighted fields");

    setSaving(true);
    try {
      const { base, files, hasFiles } = buildPayload();
      let created;

      if (hasFiles && api.createLeadMultipart) {
        const fd = new FormData();
        Object.entries(base).forEach(([k,v]) => fd.append(k, typeof v === "object" ? JSON.stringify(v) : (v ?? "")));
        Object.entries(files).forEach(([k,f]) => { if (f) fd.append(k, f); });
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
    }
  };

  // custom field renderer (unchanged API, minor polish)
  const renderCF = (cf) => {
    const key = cf.key;
    const val = custom[key] ?? (cf.type === "checkbox" ? false : "");
    const set = (v) => setCustom((s) => ({ ...s, [key]: v }));
    const base = "gg-input w-full";
    const req = cf.required && <span className="text-rose-400">*</span>;

    const wrap = (control) => (
      <div key={cf.id || key}>
        {cf.type !== "checkbox" && (
          <label className="block text-sm gg-muted mb-1">{cf.label} {req}</label>
        )}
        {control}
        {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-1">{problems[`cf:${key}`]}</div>}
      </div>
    );

    switch (cf.type) {
      case "textarea": return wrap(<textarea className={`${base} h-24`} value={val} onChange={(e)=>set(e.target.value)} />);
      case "number":   return wrap(<input type="number" className={base} value={val} onChange={(e)=>set(e.target.value)} />);
      case "date":     return wrap(<input type="date" className={base} value={val} onChange={(e)=>set(e.target.value)} />);
      case "select":   return wrap(
        <select className={base} value={val} onChange={(e)=>set(e.target.value)}>
          <option value="">Select…</option>
          {(cf.options || []).map(opt => <option key={String(opt)} value={opt}>{opt}</option>)}
        </select>
      );
      case "checkbox":
        return (
          <label key={cf.id || key} className="flex items-center gap-2">
            <input type="checkbox" checked={!!val} onChange={(e)=>set(e.target.checked)} />
            <span className="text-sm">{cf.label} {req}</span>
          </label>
        );
      default:
        return wrap(<input className={base} value={val} onChange={(e)=>set(e.target.value)} />);
    }
  };

  // quick mode = only the must-have fields
  const quickFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="block text-sm gg-muted mb-1">Lead Name <span className="text-rose-400">*</span></label>
        <input ref={firstInputRef} className="gg-input w-full" value={form.name} onChange={update("name")} placeholder="Lead name" />
        {problems.name && <div className="text-rose-400 text-xs mt-1">{problems.name}</div>}
      </div>
      <div>
        <label className="block text-sm gg-muted mb-1">Follow Up Date <span className="text-rose-400">*</span></label>
        <input type="date" className="gg-input w-full" value={form.follow_up_date} onChange={update("follow_up_date")} />
        {problems.follow_up_date && <div className="text-rose-400 text-xs mt-1">{problems.follow_up_date}</div>}
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm gg-muted mb-1">Mobile <span className="text-rose-400">*</span></label>
        <div className="flex gap-2">
          <select className="gg-input w-28" value={form.mobile_country} onChange={onCountryChange} aria-label="Country">
            {COUNTRY_OPTS.map(c => <option key={c.cc} value={c.cc}>{c.label} {c.code}</option>)}
          </select>
          <input readOnly className="gg-input w-20 text-center" value={form.mobile_code} aria-label="Dial code" />
          <input className="gg-input flex-1" value={form.mobile} onChange={update("mobile")} placeholder="Enter mobile number" />
        </div>
        <div className="text-xs mt-1" style={{color:"var(--muted)"}}>
          {dupMobile === true ? "Number exists — will be sent for approval." : "We'll check duplicates automatically."}
        </div>
        {problems.mobile && <div className="text-rose-400 text-xs mt-1">{problems.mobile}</div>}
      </div>
      <div>
        <label className="block text-sm gg-muted mb-1">Lead Stage <span className="text-rose-400">*</span></label>
        <select className="gg-input w-full" value={form.stage} onChange={update("stage")}>
          {stages.map(s => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        {problems.stage && <div className="text-rose-400 text-xs mt-1">{problems.stage}</div>}
      </div>
      <div>
        <label className="block text-sm gg-muted mb-1">Source <span className="text-rose-400">*</span></label>
        <select className="gg-input w-full" value={form.source} onChange={update("source")}>
          <option value="">Select a Source</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {problems.source && <div className="text-rose-400 text-xs mt-1">{problems.source}</div>}
      </div>
    </div>
  );

  const fullFields = (
    <>
      {quickFields}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="block text-sm gg-muted mb-1">Email</label>
          <input className="gg-input w-full" value={form.email} onChange={update("email")} placeholder="you@company.com" />
          {problems.email && <div className="text-rose-400 text-xs mt-1">{problems.email}</div>}
        </div>
        <div>
          <label className="block text-sm gg-muted mb-1">Expected Revenue</label>
          <input type="number" inputMode="decimal" className="gg-input w-full" value={form.expected_revenue} onChange={update("expected_revenue")} placeholder="Revenue" />
        </div>
        <div>
          <label className="block text-sm gg-muted mb-1">Profession</label>
          <input className="gg-input w-full" value={form.profession} onChange={update("profession")} placeholder="Profession" />
        </div>
      </div>

      <section className="gg-panel mt-4">
        <button type="button" className="w-full flex items-center justify-between px-3 py-2" onClick={()=>setOpenAdvanced(v=>!v)} aria-expanded={openAdvanced}>
          <span className="text-sm font-semibold">Advance</span>
          <span className="gg-chip">{openAdvanced ? "Hide" : "Show"}</span>
        </button>
        <div className="px-3 pb-3" style={{ display: openAdvanced ? "block" : "none" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm gg-muted mb-1">Detailed information</label>
              <textarea className="gg-input w-full h-24" value={form.details} onChange={update("details")} placeholder="Notes or context" />
            </div>
            <div>
              <label className="block text-sm gg-muted mb-1">Headshot Photo</label>
              <input type="file" className="gg-input w-full" accept="image/*" onChange={updateFile("headshot_file")} />
            </div>
            <div>
              <label className="block text-sm gg-muted mb-1">Photo of the meeting</label>
              <input type="file" className="gg-input w-full" accept="image/*" onChange={updateFile("meeting_photo_file")} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm gg-muted mb-1">Add voice record</label>
              <input type="file" className="gg-input w-full" accept="audio/*" onChange={updateFile("voice_record_file")} />
            </div>
          </div>

          {customFields?.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Custom fields</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {customFields.map(renderCF)}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
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
            <div className="gg-muted text-xs">
              {mode === "quick" ? "Quick add — only required fields" : "Full form — everything at once"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="gg-btn gg-btn-ghost" onClick={() => setMode(m => m === "quick" ? "full" : "quick")}>
              {mode === "quick" ? "Full form" : "Quick add"}
            </button>
            <button className="gg-btn gg-btn-ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-4 space-y-4 overflow-auto h-[calc(100%-56px-64px)]">
          <section className="gg-panel p-3">
            <div className="text-sm font-semibold mb-2">General</div>
            {mode === "quick" ? quickFields : fullFields}
          </section>

          {error && (
            <div className="rounded-md border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[color:var(--border)]">
          <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button id="addlead-save" className="gg-btn gg-btn-primary" type="submit" onClick={submit} disabled={saving || !isValid}>
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      </aside>

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

function cap(s){ return String(s||"").charAt(0).toUpperCase() + String(s||"").slice(1); }
