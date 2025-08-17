import React, { useEffect, useState } from "react";

/* ---- tiny API helper with local fallback (same pattern as other admin pages) ---- */
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

/* ---- UI helpers ---- */
const Field = ({ label, children, className = "" }) => (
  <label className={"block " + className}>
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
      "w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 min-h-[90px] " +
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

/* ---- defaults ---- */
const defaultProfile = {
  name:"", legal_name:"", domain:"", industry:"", about:"",
  brand_color:"#5b6cff", theme:"dark", logo_url:"",
  contact_name:"", contact_email:"", contact_phone:"",
  support_email:"", support_phone:"",
  address1:"", address2:"", city:"", state:"", postal_code:"", country:"India",
  timezone:"Asia/Kolkata", currency:"INR",
  gstin:"", pan:"", cin:"",
  website:"", linkedin:"", twitter:"", facebook:"", instagram:"", youtube:""
};

const defaultTaxConfig = {
  gst: {
    registered: false,
    composition: false,
    e_invoicing: false,
    place_of_supply: "IN",
    invoice_series: "INV-25-26",
  },
  rounding: "invoice", // 'invoice' | 'item'
  jurisdictions: [
    {
      code: "IN",
      name: "India",
      type: "GST",
      rates: [
        { label: "GST Standard", rate: 18, code: "GST_STD" },
        { label: "GST Reduced", rate: 5, code: "GST_RED" }
      ]
    }
  ],
  exemptions: [
    // { name: "Education services", hsn_sac: "9992", notes: "Exempt under notification ..." }
  ],
  eu_vat: { enabled: false, oss: false },
  us_sales_tax: { enabled: false, origin_state: "" }
};

export default function TaxCompliance() {
  const [profile, setProfile] = useState(defaultProfile);
  const [tax, setTax] = useState(defaultTaxConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const loaded = await safeGet("/admin/org-profile", "org_profile_cache");
      if (loaded) setProfile((p) => ({ ...p, ...loaded }));
      const localTax = localStorage.getItem("tax_config_v1");
      if (localTax) {
        try { setTax({ ...defaultTaxConfig, ...JSON.parse(localTax) }); } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const setTaxAt = (path, value) => {
    setTax((t) => {
      const next = structuredClone ? structuredClone(t) : JSON.parse(JSON.stringify(t));
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys.at(-1)] = value;
      return next;
    });
  };

  const addJurisdiction = () => {
    setTax((t) => ({
      ...t,
      jurisdictions: [
        ...t.jurisdictions,
        { code: "", name: "", type: "GST", rates: [{ label: "", rate: 0, code: "" }] }
      ]
    }));
  };
  const removeJurisdiction = (idx) => {
    setTax((t) => ({
      ...t,
      jurisdictions: t.jurisdictions.filter((_, i) => i !== idx)
    }));
  };
  const updateJurisdiction = (idx, key, val) => {
    setTax((t) => {
      const copy = [...t.jurisdictions];
      copy[idx] = { ...copy[idx], [key]: val };
      return { ...t, jurisdictions: copy };
    });
  };
  const addRate = (jdx) => {
    setTax((t) => {
      const copy = [...t.jurisdictions];
      copy[jdx] = { ...copy[jdx], rates: [...copy[jdx].rates, { label: "", rate: 0, code: "" }] };
      return { ...t, jurisdictions: copy };
    });
  };
  const removeRate = (jdx, rdx) => {
    setTax((t) => {
      const copy = [...t.jurisdictions];
      copy[jdx] = { ...copy[jdx], rates: copy[jdx].rates.filter((_, i) => i !== rdx) };
      return { ...t, jurisdictions: copy };
    });
  };
  const updateRate = (jdx, rdx, key, val) => {
    setTax((t) => {
      const copy = [...t.jurisdictions];
      const rc = [...copy[jdx].rates];
      rc[rdx] = { ...rc[rdx], [key]: val };
      copy[jdx] = { ...copy[jdx], rates: rc };
      return { ...t, jurisdictions: copy };
    });
  };

  const addExemption = () => {
    setTax((t) => ({ ...t, exemptions: [...t.exemptions, { name: "", hsn_sac: "", notes: "" }] }));
  };
  const updateExemption = (idx, key, val) => {
    setTax((t) => {
      const copy = [...t.exemptions];
      copy[idx] = { ...copy[idx], [key]: val };
      return { ...t, exemptions: copy };
    });
  };
  const removeExemption = (idx) => {
    setTax((t) => ({ ...t, exemptions: t.exemptions.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      // Save IDs to backend org-profile (single source of truth)
      const nextProfile = await safePut("/admin/org-profile", profile, "org_profile_cache");
      setProfile(nextProfile);
      // Save tax config locally (or wire to /admin/tax later without changing UI)
      localStorage.setItem("tax_config_v1", JSON.stringify(tax));
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1200);
    } catch {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Tax & Compliance</div>
          <h1 className="text-2xl md:text-3xl font-bold">Tax & Compliance</h1>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Registrations & IDs (backend) */}
      <Section
        title="Registrations & IDs"
        desc="Your legal identifiers; stored in Organization Profile."
      >
        <Field label="GSTIN">
          <Input
            placeholder="22AAAAA0000A1Z5"
            value={profile.gstin}
            onChange={(e) => setProfile((p) => ({ ...p, gstin: e.target.value.trim() }))}
          />
        </Field>
        <Field label="PAN">
          <Input
            placeholder="ABCDE1234F"
            value={profile.pan}
            onChange={(e) => setProfile((p) => ({ ...p, pan: e.target.value.trim() }))}
          />
        </Field>
        <Field label="CIN">
          <Input
            placeholder="L12345MH2010PLC123456"
            value={profile.cin}
            onChange={(e) => setProfile((p) => ({ ...p, cin: e.target.value.trim() }))}
          />
        </Field>

        <Field label="GST Registered">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input
              type="checkbox"
              checked={tax.gst.registered}
              onChange={(e) => setTaxAt("gst.registered", e.target.checked)}
            />
            <span className="text-sm">Registered under GST</span>
          </label>
        </Field>

        <Field label="Composition Scheme">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input
              type="checkbox"
              checked={tax.gst.composition}
              onChange={(e) => setTaxAt("gst.composition", e.target.checked)}
              disabled={!tax.gst.registered}
            />
            <span className="text-sm">Composition taxpayer</span>
          </label>
        </Field>

        <Field label="E-Invoicing (IRN)">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input
              type="checkbox"
              checked={tax.gst.e_invoicing}
              onChange={(e) => setTaxAt("gst.e_invoicing", e.target.checked)}
              disabled={!tax.gst.registered}
            />
            <span className="text-sm">Enable e-invoicing</span>
          </label>
        </Field>

        <Field label="Place of Supply (ISO code)">
          <Input
            placeholder="IN"
            value={tax.gst.place_of_supply}
            onChange={(e) => setTaxAt("gst.place_of_supply", e.target.value.toUpperCase())}
          />
        </Field>

        <Field label="Invoice Series">
          <Input
            placeholder="INV-25-26"
            value={tax.gst.invoice_series}
            onChange={(e) => setTaxAt("gst.invoice_series", e.target.value)}
          />
        </Field>
      </Section>

      {/* Jurisdictions & Rates (local config for now) */}
      <Section
        title="Jurisdictions & Rates"
        desc="Maintain tax jurisdictions and rate codes. This is stored locally for now."
      >
        <div className="md:col-span-2 space-y-4">
          {tax.jurisdictions.map((j, jdx) => (
            <div key={jdx} className="rounded-xl border border-white/10 bg-[#0B0D10] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium opacity-80">#{jdx + 1}</div>
                <button
                  className="text-sm px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                  onClick={() => removeJurisdiction(jdx)}
                >
                  Remove
                </button>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <Field label="Code">
                  <Input value={j.code} onChange={(e) => updateJurisdiction(jdx, "code", e.target.value.toUpperCase())} />
                </Field>
                <Field label="Name">
                  <Input value={j.name} onChange={(e) => updateJurisdiction(jdx, "name", e.target.value)} />
                </Field>
                <Field label="Type">
                  <select
                    className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                    value={j.type}
                    onChange={(e) => updateJurisdiction(jdx, "type", e.target.value)}
                  >
                    <option>GST</option>
                    <option>VAT</option>
                    <option>Sales Tax</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <button
                    className="w-full text-sm px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                    onClick={() => addRate(jdx)}
                  >
                    + Add Rate
                  </button>
                </div>
              </div>

              {/* Rates list */}
              <div className="mt-3 grid md:grid-cols-3 gap-3">
                {j.rates.map((r, rdx) => (
                  <div key={rdx} className="rounded-lg border border-white/10 p-3">
                    <Field label="Label">
                      <Input value={r.label} onChange={(e) => updateRate(jdx, rdx, "label", e.target.value)} />
                    </Field>
                    <Field label="Rate (%)">
                      <Input
                        type="number"
                        step="0.01"
                        value={r.rate}
                        onChange={(e) => updateRate(jdx, rdx, "rate", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Code">
                      <Input value={r.code} onChange={(e) => updateRate(jdx, rdx, "code", e.target.value)} />
                    </Field>
                    <div className="mt-2">
                      <button
                        className="w-full text-sm px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                        onClick={() => removeRate(jdx, rdx)}
                      >
                        Remove Rate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            className="text-sm px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
            onClick={addJurisdiction}
          >
            + Add Jurisdiction
          </button>
        </div>
      </Section>

      {/* Exemptions / HSN-SAC */}
      <Section
        title="Exemptions & HSN/SAC"
        desc="List items/services that are exempt or zero-rated."
      >
        <div className="md:col-span-2 space-y-3">
          {tax.exemptions.map((ex, idx) => (
            <div key={idx} className="grid md:grid-cols-12 gap-3 bg-[#0B0D10] border border-white/10 rounded-xl p-3">
              <Field label="Name" className="md:col-span-4">
                <Input value={ex.name} onChange={(e) => updateExemption(idx, "name", e.target.value)} />
              </Field>
              <Field label="HSN/SAC" className="md:col-span-3">
                <Input value={ex.hsn_sac} onChange={(e) => updateExemption(idx, "hsn_sac", e.target.value)} />
              </Field>
              <Field label="Notes" className="md:col-span-5">
                <Textarea value={ex.notes} onChange={(e) => updateExemption(idx, "notes", e.target.value)} />
              </Field>
              <div className="md:col-span-12">
                <button
                  className="text-sm px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                  onClick={() => removeExemption(idx)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            className="text-sm px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
            onClick={addExemption}
          >
            + Add Exemption
          </button>
        </div>
      </Section>

      {/* Invoicing rules */}
      <Section
        title="Invoicing Rules"
        desc="Rounding and series settings used during invoice tax calculation."
      >
        <Field label="Rounding">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={tax.rounding}
            onChange={(e) => setTaxAt("rounding", e.target.value)}
          >
            <option value="invoice">Round at invoice total</option>
            <option value="item">Round per line item</option>
          </select>
        </Field>
        <div className="md:col-span-2 text-xs text-gray-400">
          Note: Full tax engine (place of supply, CGST/SGST/IGST split, reverse charge, etc.) can be
          wired to a backend `/admin/tax` service later. This UI won’t need to change.
        </div>
      </Section>
    </div>
  );
}
