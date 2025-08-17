import React, { useEffect, useRef, useState } from "react";

/* ---- tiny API helper with local fallback ---- */
const API_BASE = import.meta.env.VITE_API_URL || "/api";
async function safeGet(path, fallbackKey) {
  try {
    const r = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!r.ok) throw new Error("bad status");
    return await r.json();
  } catch {
    const raw = localStorage.getItem(fallbackKey);
    return raw ? JSON.parse(raw) : null;
  }
}
async function safePut(path, body, fallbackKey) {
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    const json = await r.json();
    localStorage.setItem(fallbackKey, JSON.stringify(json));
    return json;
  } catch {
    localStorage.setItem(fallbackKey, JSON.stringify(body));
    return body;
  }
}

const Field = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</span>
    {children}
  </label>
);
const Input = (p) => (
  <input
    {...p}
    className={
      "w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " +
      (p.className || "")
    }
  />
);
const Textarea = (p) => (
  <textarea
    {...p}
    className={
      "w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 min-h-[110px] " +
      (p.className || "")
    }
  />
);
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5">
      <div className="text-base md:text-lg font-semibold">{title}</div>
      {desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </section>
);

export default function OrganizationProfile() {
  const [data, setData] = useState({
    name:"", legal_name:"", domain:"", industry:"", about:"",
    brand_color:"#5b6cff", theme:"dark", logo_url:"",
    contact_name:"", contact_email:"", contact_phone:"",
    support_email:"", support_phone:"",
    address1:"", address2:"", city:"", state:"", postal_code:"", country:"India",
    timezone:"Asia/Kolkata", currency:"INR",
    gstin:"", pan:"", cin:"",
    website:"", linkedin:"", twitter:"", facebook:"", instagram:"", youtube:""
  });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      const loaded = await safeGet("/admin/org-profile", "org_profile_cache");
      if (loaded) setData((d) => ({ ...d, ...loaded }));
      setLoading(false);
    })();
  }, []);

  function onChange(k, v) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function onPickLogo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const limitMb = 1.5;
    if (f.size > limitMb * 1024 * 1024) return setMsg(`Logo too large (max ${limitMb}MB)`);
    const reader = new FileReader();
    reader.onload = (ev) => onChange("logo_url", String(ev.target?.result || ""));
    reader.readAsDataURL(f);
  }

  async function onSave() {
    setSaving(true); setMsg("");
    try {
      await safePut("/admin/org-profile", data, "org_profile_cache");
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-7 w-52 bg-white/10 rounded mb-6 animate-pulse" />
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Settings</div>
          <h1 className="text-2xl md:text-3xl font-bold">Organization Profile</h1>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <Section title="Brand" desc="Logo, brand color, theme and identity.">
        <div className="md:col-span-2 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-[#0B0D10] border border-white/10 grid place-items-center overflow-hidden">
            {data.logo_url ? (
              <img src={data.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-gray-400">Logo</span>
            )}
          </div>
          <div className="space-x-2">
            <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => fileRef.current?.click()}>
              Upload Logo
            </button>
            <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => onChange("logo_url", "")}>
              Remove
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
          </div>
          <div className="ml-auto hidden md:block">
            <div className="rounded-xl border border-white/10 p-3">
              <div className="text-xs text-gray-400 mb-1">Preview</div>
              <div className="rounded-lg px-4 py-2" style={{ background: data.brand_color }}>
                <div className="text-white font-semibold">{data.name || "Your Brand"}</div>
              </div>
            </div>
          </div>
        </div>
        <Field label="Organization Name"><Input value={data.name} onChange={(e)=>onChange("name", e.target.value)} /></Field>
        <Field label="Legal Name"><Input value={data.legal_name} onChange={(e)=>onChange("legal_name", e.target.value)} /></Field>
        <Field label="Domain"><Input placeholder="geniusgrid.app" value={data.domain} onChange={(e)=>onChange("domain", e.target.value)} /></Field>
        <Field label="Primary Brand Color">
          <div className="flex items-center gap-2">
            <Input type="color" value={data.brand_color} onChange={(e)=>onChange("brand_color", e.target.value)} className="h-10 w-16 p-1" />
            <Input value={data.brand_color} onChange={(e)=>onChange("brand_color", e.target.value)} />
          </div>
        </Field>
        <Field label="Theme">
          <select className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2" value={data.theme} onChange={(e)=>onChange("theme", e.target.value)}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="night">Night</option>
          </select>
        </Field>
        <Field label="Industry">
          <select className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2" value={data.industry} onChange={(e)=>onChange("industry", e.target.value)}>
            <option value=""></option>
            {["Education","IT/Software","Manufacturing","Healthcare","Retail","Real Estate","Other"].map((i)=>(
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="About"><Textarea value={data.about} onChange={(e)=>onChange("about", e.target.value)} /></Field>
      </Section>

      <Section title="Contacts">
        <Field label="Primary Contact Name"><Input value={data.contact_name} onChange={(e)=>onChange("contact_name", e.target.value)} /></Field>
        <Field label="Primary Contact Email"><Input type="email" value={data.contact_email} onChange={(e)=>onChange("contact_email", e.target.value)} /></Field>
        <Field label="Primary Contact Phone"><Input value={data.contact_phone} onChange={(e)=>onChange("contact_phone", e.target.value)} /></Field>
        <Field label="Support Email"><Input type="email" value={data.support_email} onChange={(e)=>onChange("support_email", e.target.value)} /></Field>
        <Field label="Support Phone"><Input value={data.support_phone} onChange={(e)=>onChange("support_phone", e.target.value)} /></Field>
      </Section>

      <Section title="Registered Address">
        <Field label="Address line 1"><Input value={data.address1} onChange={(e)=>onChange("address1", e.target.value)} /></Field>
        <Field label="Address line 2"><Input value={data.address2} onChange={(e)=>onChange("address2", e.target.value)} /></Field>
        <Field label="City"><Input value={data.city} onChange={(e)=>onChange("city", e.target.value)} /></Field>
        <Field label="State"><Input value={data.state} onChange={(e)=>onChange("state", e.target.value)} /></Field>
        <Field label="Postal Code"><Input value={data.postal_code} onChange={(e)=>onChange("postal_code", e.target.value)} /></Field>
        <Field label="Country"><Input value={data.country} onChange={(e)=>onChange("country", e.target.value)} /></Field>
      </Section>

      <Section title="Locale & Preferences">
        <Field label="Timezone">
          <select className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2" value={data.timezone} onChange={(e)=>onChange("timezone", e.target.value)}>
            {["Asia/Kolkata","Asia/Dubai","UTC","America/New_York","Europe/London","Asia/Singapore"].map((tz)=>(
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2" value={data.currency} onChange={(e)=>onChange("currency", e.target.value)}>
            {["INR","USD","AED","EUR","GBP","SGD"].map((c)=>(
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Registration & Tax IDs">
        <Field label="GSTIN"><Input value={data.gstin} onChange={(e)=>onChange("gstin", e.target.value)} /></Field>
        <Field label="PAN"><Input value={data.pan} onChange={(e)=>onChange("pan", e.target.value)} /></Field>
        <Field label="CIN"><Input value={data.cin} onChange={(e)=>onChange("cin", e.target.value)} /></Field>
      </Section>

      <Section title="Web & Social">
        <Field label="Website"><Input placeholder="https://…" value={data.website} onChange={(e)=>onChange("website", e.target.value)} /></Field>
        <Field label="LinkedIn"><Input value={data.linkedin} onChange={(e)=>onChange("linkedin", e.target.value)} /></Field>
        <Field label="Twitter/X"><Input value={data.twitter} onChange={(e)=>onChange("twitter", e.target.value)} /></Field>
        <Field label="Facebook"><Input value={data.facebook} onChange={(e)=>onChange("facebook", e.target.value)} /></Field>
        <Field label="Instagram"><Input value={data.instagram} onChange={(e)=>onChange("instagram", e.target.value)} /></Field>
        <Field label="YouTube"><Input value={data.youtube} onChange={(e)=>onChange("youtube", e.target.value)} /></Field>
      </Section>
    </div>
  );
}
