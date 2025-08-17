import React, { useEffect, useState, useRef } from "react";

/* ---- tiny API helper with local fallback (same as Org page) ---- */
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

export default function BrandingTheme() {
  const [profile, setProfile] = useState({
    name:"", brand_color:"#5b6cff", theme:"dark", logo_url:""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const logoRef = useRef(null);

  useEffect(() => {
    (async () => {
      const loaded = await safeGet("/admin/org-profile", "org_profile_cache");
      if (loaded) {
        setProfile((p) => ({ ...p, ...loaded }));
      }
      setLoading(false);
    })();
  }, []);

  const onChange = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const onPickLogo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const limitMb = 1.5;
    if (f.size > limitMb * 1024 * 1024) return setMsg(`Logo too large (max ${limitMb}MB)`);
    const reader = new FileReader();
    reader.onload = (ev) => onChange("logo_url", String(ev.target?.result || ""));
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      // Save back to the same org-profile endpoint to keep one source of truth.
      const next = await safePut("/admin/org-profile", profile, "org_profile_cache");
      setProfile(next);
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
          {[...Array(4)].map((_, i) => (
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
          <div className="text-sm text-gray-400">Admin / Branding</div>
          <h1 className="text-2xl md:text-3xl font-bold">Branding & Theme</h1>
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

      {/* Card */}
      <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-[#0B0D10] border border-white/10 grid place-items-center overflow-hidden">
              {profile.logo_url ? (
                <img src={profile.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">Logo</span>
              )}
            </div>
            <div className="space-x-2">
              <button
                className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                onClick={() => logoRef.current?.click()}
              >
                Upload Logo
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                onClick={() => onChange("logo_url", "")}
              >
                Remove
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-white/10 p-3">
            <div className="text-xs text-gray-400 mb-1">Preview</div>
            <div className="rounded-lg px-4 py-3" style={{ background: profile.brand_color }}>
              <div className="text-white font-semibold">{profile.name || "Your Brand"}</div>
              <div className="text-white/80 text-xs">{profile.theme.toUpperCase()} theme</div>
            </div>
          </div>

          {/* Brand color */}
          <Field label="Primary Brand Color">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={profile.brand_color}
                onChange={(e) => onChange("brand_color", e.target.value)}
                className="h-10 w-16 p-1"
              />
              <Input
                value={profile.brand_color}
                onChange={(e) => onChange("brand_color", e.target.value)}
              />
            </div>
          </Field>

          {/* Theme */}
          <Field label="Theme">
            <select
              className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
              value={profile.theme}
              onChange={(e) => onChange("theme", e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="night">Night</option>
            </select>
          </Field>
        </div>
      </section>
    </div>
  );
}
