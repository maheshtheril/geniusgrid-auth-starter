import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useLeadsApi from "@/hooks/useLeadsApi";

/** Shape for custom fields
 * customFields = [
 *  { id:"cf1", key:"profession", label:"Profession", type:"text", required:false },
 *  { id:"cf2", key:"lifecycle",  label:"Lead Life Cycle", type:"select", options:["Monthly","Quarterly"], required:false },
 *  { id:"cf3", key:"rating",     label:"Rating", type:"number" },
 *  { id:"cf4", key:"notes",      label:"Notes", type:"textarea" },
 *  { id:"cf5", key:"nda",        label:"NDA Signed", type:"checkbox" },
 * ]
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
  customFields = [],              // see shape above
}) {
  const api = useLeadsApi();

  // form state
  const [form, setForm] = useState({ ...INIT, ...(prefill || {}) });
  const [custom, setCustom] = useState({}); // dynamic custom fields
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openAdvanced, setOpenAdvanced] = useState(true);

  // refs
  const firstInputRef = useRef(null);

  // prepare country code map
  const codeByCc = useMemo(() => Object.fromEntries(COUNTRY_OPTS.map(c => [c.cc, c.code])), []);

  // life-cycle: lock body scroll, esc to close, focus first input
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

  // reset when prefill updates
  useEffect(() => {
    setForm({ ...INIT, ...(prefill || {}) });
    setCustom({});
  }, [prefill]);

  // helpers
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target?.value ?? e }));
  const updateFile = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.files?.[0] || null }));

  const onCountryChange = (e) => {
    const cc = e.target.value;
    setForm(f => ({ ...f, mobile_country: cc, mobile_code: codeByCc[cc] || "" }));
  };

  // validation
  const problems = useMemo(() => {
    const p = {};
    if (!form.name.trim()) p.name = "Lead name is required";
    if (!form.mobile.trim()) p.mobile = "Mobile is required";
    if (!form.follow_up_date) p.follow_up_date = "Follow-up date is required";
    if (!form.stage) p.stage = "Lead stage is required";
    if (!form.source) p.source = "Source is required";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) p.email = "Invalid email";
    if (form.mobile && !/^[0-9\-()+\s]{6,20}$/.test(form.mobile)) p.mobile = "Invalid phone number";

    // custom-field required
    for (const cf of customFields) {
      if (cf.required && !valueForCF(custom, cf)) {
        p[`cf:${cf.key}`] = `${cf.label} is required`;
      }
    }
    return p;
  }, [form, custom, customFields]);

  const isValid = Object.keys(problems).length === 0;

  function valueForCF(store, cf) {
    const v = store?.[cf.key];
    if (cf.type === "checkbox") return !!v;
    return (v ?? "") !== "";
  }

  const submit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!isValid) return setError("Please fix the highlighted fields");

    setSaving(true);
    try {
      // payload
      const payload = {
        name: form.name.trim(),
        mobile: `${form.mobile_code} ${form.mobile.trim()}`,
        email: form.email.trim() || null,
        expected_revenue: form.expected_revenue ? Number(form.expected_revenue) : null,
        follow_up_date: form.follow_up_date,
        profession: form.profession || null,
        stage: form.stage,
        status: form.status || "new",
        source: form.source,
        custom_fields: custom,  // dynamic values
      };

      // If you need file upload, switch to FormData and expose api.createLeadMultipart
      // For now: send JSON; you can handle files later server-side.
      const created = await api.createLead(payload);

      // micro success pulse
      const btn = document.getElementById("addlead-save");
      if (btn) {
        btn.classList.add("success-pulse");
        setTimeout(() => onSuccess?.(created), 220);
      } else {
        onSuccess?.(created);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // field render for custom fields
  const renderCF = (cf) => {
    const key = cf.key;
    const val = custom[key] ?? (cf.type === "checkbox" ? false : "");
    const set = (v) => setCustom((s) => ({ ...s, [key]: v }));

    const base = "gg-input w-full";
    const label = (
      <label className="block text-sm gg-muted mb-1">
        {cf.label} {cf.required && <span className="text-rose-400">*</span>}
      </label>
    );

    switch (cf.type) {
      case "textarea":
        return (
          <div key={cf.id || key}>
            {label}
            <textarea className={`${base} h-24`} value={val} onChange={(e)=>set(e.target.value)} />
            {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-1">{problems[`cf:${key}`]}</div>}
          </div>
        );
      case "number":
        return (
          <div key={cf.id || key}>
            {label}
            <input type="number" className={base} value={val} onChange={(e)=>set(e.target.value)} />
            {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-1">{problems[`cf:${key}`]}</div>}
          </div>
        );
      case "date":
        return (
          <div key={cf.id || key}>
            {label}
            <input type="date" className={base} value={val} onChange={(e)=>set(e.target.value)} />
            {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-1">{problems[`cf:${key}`]}</div>}
          </div>
        );
      case "select":
        return (
          <div key={cf.id || key}>
            {label}
            <select className={base} value={val} onChange={(e)=>set(e.target.value)}>
              <option value="">Select…</option>
              {(cf.options || []).map(opt => <option key={String(opt)} value={opt}>{opt}</option>)}
            </select>
            {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-1">{problems[`cf:${key}`]}</div>}
          </div>
        );
      case "checkbox":
        return (
          <label key={cf.id || key} className="flex items-center gap-2">
            <input type="checkbox" checked={!!val} onChange={(e)=>set(e.target.checked)} />
            <span className="text-sm">{label.props.children}</span>
          </label>
        );
      default: // text
        return (
          <div key={cf.id || key}>
            {label}
            <input className={base} value={val} onChange={(e)=>set(e.target.value)} />
            {problems[`cf:${key}`] && <div className="text-rose-400 text-xs mt-1">{problems[`cf:${key}`]}</div>}
          </div>
        );
    }
  };

  const el = (
    <div className="fixed inset-0 z-[100]">
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
            <div className="gg-muted text-xs">Enter the essentials — advanced details are optional.</div>
          </div>
          <button className="gg-btn gg-btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-4 space-y-4 overflow-auto h-[calc(100%-56px-64px)]">
          {/* General grid */}
          <section className="gg-panel p-3">
            <div className="text-sm font-semibold mb-2">General</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm gg-muted mb-1">Lead Name <span className="text-rose-400">*</span></label>
                <input ref={firstInputRef} className="gg-input w-full" value={form.name} onChange={update("name")} placeholder="Lead name" />
                {problems.name && <div className="text-rose-400 text-xs mt-1">{problems.name}</div>}
              </div>

              <div>
                <label className="block text-sm gg-muted mb-1">Mobile <span className="text-rose-400">*</span></label>
                <div className="flex gap-2">
                  <select className="gg-input w-28" value={form.mobile_country} onChange={onCountryChange} aria-label="Country">
                    {COUNTRY_OPTS.map(c => <option key={c.cc} value={c.cc}>{c.label} {c.code}</option>)}
                  </select>
                  <input readOnly className="gg-input w-20 text-center" value={form.mobile_code} aria-label="Dial code" />
                  <input className="gg-input flex-1" value={form.mobile} onChange={update("mobile")} placeholder="Enter Mobile Number" />
                </div>
                <div className="text-xs mt-1" style={{color:"var(--muted)"}}>
                  Duplicate mobile numbers will be sent for approval.
                </div>
                {problems.mobile && <div className="text-rose-400 text-xs mt-1">{problems.mobile}</div>}
              </div>

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
                <label className="block text-sm gg-muted mb-1">Follow Up Date <span className="text-rose-400">*</span></label>
                <input type="date" className="gg-input w-full" value={form.follow_up_date} onChange={update("follow_up_date")} />
                {problems.follow_up_date && <div className="text-rose-400 text-xs mt-1">{problems.follow_up_date}</div>}
              </div>

              <div>
                <label className="block text-sm gg-muted mb-1">Profession</label>
                <input className="gg-input w-full" value={form.profession} onChange={update("profession")} placeholder="Profession" />
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
          </section>

          {/* Advance (collapsible) */}
          <section className="gg-panel">
            <button type="button"
                    className="w-full flex items-center justify-between px-3 py-2"
                    onClick={()=>setOpenAdvanced(v=>!v)}
                    aria-expanded={openAdvanced}>
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

              {/* Custom fields grid */}
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
