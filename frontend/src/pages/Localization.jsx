import React, { useEffect, useState } from "react";

/* ---- tiny API helper with local fallback (same pattern as others) ---- */
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

const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5">
      <div className="text-base md:text-lg font-semibold">{title}</div>
      {desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </section>
);

const TZONES = ["Asia/Kolkata","Asia/Dubai","UTC","America/New_York","Europe/London","Asia/Singapore"];
const CURRENCIES = ["INR","USD","AED","EUR","GBP","SGD"];
const LANGS = [
  "English (India) – en-IN",
  "English (US) – en-US",
  "Hindi – hi-IN",
  "Arabic – ar",
  "French – fr-FR",
  "German – de-DE"
];

export default function Localization() {
  // Full org profile (so backend save always has expected keys)
  const [profile, setProfile] = useState({
    name:"", legal_name:"", domain:"", industry:"", about:"",
    brand_color:"#5b6cff", theme:"dark", logo_url:"",
    contact_name:"", contact_email:"", contact_phone:"",
    support_email:"", support_phone:"",
    address1:"", address2:"", city:"", state:"", postal_code:"", country:"India",
    timezone:"Asia/Kolkata", currency:"INR",
    gstin:"", pan:"", cin:"",
    website:"", linkedin:"", twitter:"", facebook:"", instagram:"", youtube:""
  });

  // Local-only prefs (persisted to localStorage, not required on backend)
  const [prefs, setPrefs] = useState({
    default_language: "English (India) – en-IN",
    enabled_languages: ["English (India) – en-IN"],
    date_format: "DD/MM/YYYY",
    time_format: "24h",
    number_format: "1,23,456.78 (India)",
    first_day_of_week: "Monday"
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Load org profile + local-only prefs
  useEffect(() => {
    (async () => {
      const loaded = await safeGet("/admin/org-profile", "org_profile_cache");
      if (loaded) setProfile((p) => ({ ...p, ...loaded }));

      const raw = localStorage.getItem("localization_prefs");
      if (raw) {
        try { setPrefs(JSON.parse(raw)); } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));

  // Save: (a) backend: only org-profile (timezone, currency kept in profile)
  //       (b) local: localization extras in localStorage
  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const next = await safePut("/admin/org-profile", profile, "org_profile_cache");
      setProfile(next);
      localStorage.setItem("localization_prefs", JSON.stringify(prefs));
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1200);
    } catch {
      setMsg("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleLang = (label) => {
    setPrefs((p) => {
      const has = p.enabled_languages.includes(label);
      const enabled_languages = has
        ? p.enabled_languages.filter((x) => x !== label)
        : [...p.enabled_languages, label];
      // Keep default_language valid
      const default_language = enabled_languages.includes(p.default_language)
        ? p.default_language
        : (enabled_languages[0] || label);
      return { ...p, enabled_languages, default_language };
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-7 w-52 bg-white/10 rounded mb-6 animate-pulse" />
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(5)].map((_, i) => (
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
          <div className="text-sm text-gray-400">Admin / Localization</div>
          <h1 className="text-2xl md:text-3xl font-bold">Localization</h1>
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

      {/* Languages */}
      <Section
        title="Languages"
        desc="Choose enabled languages and a default application language."
      >
        <div className="md:col-span-2">
          <div className="grid md:grid-cols-2 gap-3">
            {LANGS.map((l) => (
              <label key={l} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                <input
                  type="checkbox"
                  checked={prefs.enabled_languages.includes(l)}
                  onChange={() => toggleLang(l)}
                />
                <span className="text-sm">{l}</span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Default Language">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={prefs.default_language}
            onChange={(e) => setPref("default_language", e.target.value)}
          >
            {prefs.enabled_languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* Formats */}
      <Section
        title="Regional Formats"
        desc="Set date, time, number formats and first day of week."
      >
        <Field label="Date Format">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={prefs.date_format}
            onChange={(e) => setPref("date_format", e.target.value)}
          >
            <option>DD/MM/YYYY</option>
            <option>MM/DD/YYYY</option>
            <option>YYYY-MM-DD</option>
          </select>
        </Field>

        <Field label="Time Format">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={prefs.time_format}
            onChange={(e) => setPref("time_format", e.target.value)}
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour (AM/PM)</option>
          </select>
        </Field>

        <Field label="Number Format">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={prefs.number_format}
            onChange={(e) => setPref("number_format", e.target.value)}
          >
            <option>1,23,456.78 (India)</option>
            <option>1,234,567.89 (International)</option>
          </select>
        </Field>

        <Field label="First Day of Week">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={prefs.first_day_of_week}
            onChange={(e) => setPref("first_day_of_week", e.target.value)}
          >
            <option>Monday</option>
            <option>Sunday</option>
          </select>
        </Field>
      </Section>

      {/* Backend-managed (part of org profile) */}
      <Section
        title="Org Locale (Backend)"
        desc="Timezone and currency are part of your Organization Profile."
      >
        <Field label="Timezone">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={profile.timezone}
            onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
          >
            {TZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>

        <Field label="Currency">
          <select
            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
            value={profile.currency}
            onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2 text-xs text-gray-400">
          Tip: Other localization fields above are stored client-side for now and can be
          moved server-side later (API `/admin/localization`) without changing this UI.
        </div>
      </Section>
    </div>
  );
}
