import React from "react";

export function FieldRenderer({ field, value, onChange, metadata }) {
  const base = "gg-input w-full";
  const label = (extra=null) => (
    <label className="block text-sm gg-muted mb-1">
      {field.label || field.key} {field.required && <span className="text-rose-400">*</span>} {extra}
    </label>
  );
  const err = field.error && <div className="text-rose-400 text-xs mt-1">{field.error}</div>;

  switch (field.type) {
    case "textarea":
      return (<div>{label()}<textarea className={`${base} h-24`} value={value||""} onChange={e=>onChange(e.target.value)} />{err}</div>);
    case "email":
      return (<div>{label()}<input type="email" className={base} value={value||""} onChange={e=>onChange(e.target.value)} />{err}</div>);
    case "number":
    case "currency":
      return (<div>{label()}<input type="number" className={base} value={value??""} onChange={e=>onChange(e.target.value)} />{err}</div>);
    case "date":
      return (<div>{label()}<input type="date" className={base} value={value||""} onChange={e=>onChange(e.target.value)} />{err}</div>);
    case "checkbox":
      return (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked)} />
          <span className="text-sm">{field.label}</span>{err}
        </label>
      );
    case "select": {
      const opts = field.options || (field.optionsRef ? (metadata?.[field.optionsRef] || []) : []);
      return (<div>{label()}<select className={base} value={value||""} onChange={e=>onChange(e.target.value)}><option value="">Select…</option>{opts.map(o=><option key={String(o)} value={o}>{o}</option>)}</select>{err}</div>);
    }
    case "file":
      return (<div>{label(<span className="text-xs">({field.accept||"any"})</span>)}<input type="file" accept={field.accept} className={base} onChange={e=>onChange(e.target.files?.[0]||null)} />{err}</div>);
    case "phone": {
      const countries = metadata?.countries?.length ? metadata.countries : [
        { cc:"IN", code:"+91", label:"IN" }, { cc:"US", code:"+1", label:"US" }, { cc:"GB", code:"+44", label:"UK" }
      ];
      const val = value || { country: countries[0].cc, dial: countries[0].code, number:"" };
      const onCountry = (cc) => {
        const c = countries.find(x=>x.cc===cc);
        onChange({ ...val, country: cc, dial: c?.code || "" });
      };
      return (
        <div>
          {label()}
          <div className="flex gap-2">
            <select className="gg-input w-28" value={val.country} onChange={e=>onCountry(e.target.value)}>
              {countries.map(c=><option key={c.cc} value={c.cc}>{c.label} {c.code}</option>)}
            </select>
            <input className="gg-input w-20 text-center" value={val.dial} readOnly />
            <input className="gg-input flex-1" value={val.number} onChange={e=>onChange({ ...val, number: e.target.value })} placeholder="Enter mobile number" />
          </div>
          {err}
        </div>
      );
    }
    default: // text
      return (<div>{label()}<input className={base} value={value||""} onChange={e=>onChange(e.target.value)} />{err}</div>);
  }
}
