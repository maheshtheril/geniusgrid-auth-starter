import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const LS_KEY = "gg_selected_modules";

// ---------------- UI primitives (tiny) ----------------
function Label({ htmlFor, children, hint }) {
  return (
    <div className="flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-sm text-muted">{children}</label>
      {hint ? <span className="text-[11px] text-muted/70">{hint}</span> : null}
    </div>
  );
}
function FieldError({ children }) {
  if (!children) return null;
  return (
    <div className="text-xs text-red-300 mt-1">
      {children}
    </div>
  );
}
function Pill({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm glass">
      {children}
      {onRemove && (
        <button className="text-muted hover:opacity-80" onClick={onRemove} aria-label="Remove">
          ×
        </button>
      )}
    </span>
  );
}
function Toggle({ id, checked, onChange, label }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={`w-10 h-6 rounded-full relative transition-all ${checked ? "bg-cyan-400/80" : "bg-white/10 border border-border"}`}
        role="switch" aria-checked={checked}
      >
        <span className={`absolute top-0.5 ${checked ? "left-5" : "left-0.5"} w-5 h-5 rounded-full bg-white/90 transition-all`} />
      </span>
      <span className="text-sm text-muted">{label}</span>
    </label>
  );
}

// ---------------- helpers ----------------
const COUNTRIES = [
  { code: "IN", name: "India", currency: "INR", phone: "+91", tz: "Asia/Kolkata" },
  { code: "US", name: "United States", currency: "USD", phone: "+1", tz: "America/New_York" },
  { code: "GB", name: "United Kingdom", currency: "GBP", phone: "+44", tz: "Europe/London" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", phone: "+971", tz: "Asia/Dubai" },
  { code: "SG", name: "Singapore", currency: "SGD", phone: "+65", tz: "Asia/Singapore" },
];
const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];
const INDUSTRIES = [
  "Services", "Manufacturing", "Retail / eCommerce", "Healthcare",
  "IT / SaaS", "Finance", "Education", "Logistics", "Other"
];
const EMP_SIZE = [
  "1–5", "6–20", "21–50", "51–200", "201–500", "501–1000", "1000+"
];

function scorePassword(pw) {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-Z]/.test(pw)) s += 1;
  if (/[a-z]/.test(pw)) s += 1;
  if (/[0-9]/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(s, 5); // 0..5
}

export default function Signup() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const code = sp.get("code");

  // ---------- catalog / selection ----------
  const [catalog, setCatalog] = useState([]);          // from DB
  const [selected, setSelected] = useState(new Set()); // chosen modules
  const [planCode, setPlanCode] = useState("free");
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---------- core account ----------
  const [tenantName, setTenantName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [employees, setEmployees] = useState("");
  const [gstVat, setGstVat] = useState("");

  // contact
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // address
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("IN");

  // localization
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");

  // auth
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [marketingOptin, setMarketingOptin] = useState(true);

  // state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({});

  const pwRef = useRef(null);
  const [caps, setCaps] = useState(false);

  // Load catalog for the picker (public endpoint)
  useEffect(() => {
    api.get("/public/modules")
      .then(({ data }) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => setCatalog([]));
  }, []);

  // If a pre-signup code exists, hydrate selection from server
  useEffect(() => {
    if (!code) {
      // Or carry over previous selection if user came here directly
      try {
        const local = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
        if (Array.isArray(local)) setSelected(new Set(local));
      } catch {}
      return;
    }
    api.get(`/public/pre-signup/${encodeURIComponent(code)}`)
      .then(({ data }) => {
        const mods = Array.isArray(data?.modules) ? data.modules : [];
        setSelected(new Set(mods));
        if (data?.plan_code) setPlanCode(String(data.plan_code));
      })
      .catch(() => {}); // expired code is fine; user can still signup
  }, [code]);

  // Keep localStorage in sync so the post-login installer can use it
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(Array.from(selected)));
  }, [selected]);

  // Adjust defaults when country changes
  useEffect(() => {
    const c = COUNTRIES.find((c) => c.code === country);
    if (!c) return;
    setCurrency((cur) => cur || c.currency);
    setTimezone((tz) => tz || c.tz);
    // auto-prefill phone dial code if empty
    if (!phone) setPhone(c.phone + " ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // caps lock hint
  useEffect(() => {
    const el = pwRef.current;
    if (!el) return;
    const handler = (e) => setCaps(e.getModifierState && e.getModifierState("CapsLock"));
    el.addEventListener("keyup", handler);
    el.addEventListener("keydown", handler);
    return () => {
      el.removeEventListener("keyup", handler);
      el.removeEventListener("keydown", handler);
    };
  }, []);

  const selectedList = useMemo(() => Array.from(selected), [selected]);
  const pwScore = scorePassword(password);
  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const websiteValid = !website || /^https?:\/\/.+/i.test(website);

  function toggleModule(code) {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  }

  function markTouched(k) {
    setTouched((t) => ({ ...t, [k]: true }));
  }

  function getFieldError() {
    if (!tenantName.trim()) return "Please enter your company/tenant name.";
    if (!fullName.trim()) return "Please enter your name.";
    if (!emailValid) return "Please enter a valid email.";
    if (!password || password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    if (!agree) return "Please accept the terms to continue.";
    if (!websiteValid) return "Website must start with http(s)://";
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const msg = getFieldError();
    if (msg) {
      setError(msg);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        // account
        tenantName: tenantName.trim(),
        website: website.trim(),
        industry,
        employees,
        gstVat: gstVat.trim(),
        // contact
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        // address
        address: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          postal: postal.trim(),
          country,
        },
        // localization
        language,
        timezone,
        currency,
        // modules & plan
        selectedModules: selectedList,
        planCode,
        code, // optional attribution code
        // auth
        password,
        marketingOptin,
      };

      await api.post("/public/signup", payload);
      nav("/verify-email");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Signup failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-extrabold">Create your GeniusGrid account</h1>
      <p className="text-muted mt-1">Free plan to start. Upgrade anytime.</p>

      {/* Selected modules preview (like Odoo) */}
      <div className="glass rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Selected modules</div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="px-3 py-1 rounded-lg glass border border-border"
          >
            + Add modules
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedList.length === 0 && (
            <span className="text-muted text-sm">No modules selected yet.</span>
          )}
          {selectedList.map((m) => (
            <Pill key={m} onRemove={() => toggleModule(m)}>
              {m}
            </Pill>
          ))}
        </div>
      </div>

      {/* Signup form */}
      <form onSubmit={onSubmit} className="glass rounded-xl p-5 mt-6 grid gap-5">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2">
            {error}
          </div>
        )}

        {/* Company */}
        <div>
          <div className="text-sm font-semibold mb-2">Company</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tenant">Company / Tenant</Label>
              <input
                id="tenant"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                onBlur={() => markTouched("tenant")}
                placeholder="e.g. Acme Corp"
                required
              />
              <FieldError>{touched.tenant && !tenantName.trim() ? "Required" : ""}</FieldError>
            </div>
            <div>
              <Label htmlFor="website" hint="Optional">Website</Label>
              <input
                id="website"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onBlur={() => markTouched("website")}
                placeholder="https://example.com"
              />
              <FieldError>{touched.website && !websiteValid ? "Must start with http(s)://" : ""}</FieldError>
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                <option value="">Select…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="employees">Employees</Label>
              <select
                id="employees"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
              >
                <option value="">Select…</option>
                {EMP_SIZE.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="gst">GST / VAT (optional)</Label>
              <input
                id="gst"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={gstVat}
                onChange={(e) => setGstVat(e.target.value)}
                placeholder="e.g. 22AAAAA0000A1Z5"
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div>
          <div className="text-sm font-semibold mb-2">Contact</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullname">Your Name</Label>
              <input
                id="fullname"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => markTouched("fullname")}
                placeholder="e.g. Priya Sharma"
                required
              />
              <FieldError>{touched.fullname && !fullName.trim() ? "Required" : ""}</FieldError>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <input
                id="email"
                type="email"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched("email")}
                placeholder="you@company.com"
                required
              />
              <FieldError>{touched.email && !emailValid ? "Invalid email" : ""}</FieldError>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <input
                id="phone"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <div className="text-sm font-semibold mb-2">Address</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="street">Street</Label>
              <input
                id="street"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <input
                id="city"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="state">State / Province</Label>
              <input
                id="state"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
              />
            </div>
            <div>
              <Label htmlFor="postal">Postal Code</Label>
              <input
                id="postal"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                placeholder="PIN / ZIP"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Localization */}
        <div>
          <div className="text-sm font-semibold mb-2">Localization</div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="timezone">Time zone</Label>
              <input
                id="timezone"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Asia/Kolkata"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <input
                id="currency"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="e.g. INR"
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div>
          <div className="text-sm font-semibold mb-2">Security</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password" hint="Min 8 chars">Password</Label>
              <div className="relative">
                <input
                  id="password"
                  ref={pwRef}
                  type={showPw ? "text" : "password"}
                  className="w-full mt-1 pr-24 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched("password")}
                  placeholder="Create a strong password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted px-2 py-1 rounded-md border border-border glass"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              {caps && <div className="text-[11px] text-amber-300 mt-1">Caps Lock is ON.</div>}
              <div className="mt-2 h-2 rounded bg-white/10 overflow-hidden">
                <div
                  className={`h-2 ${pwScore <= 2 ? "bg-red-400" : pwScore === 3 ? "bg-yellow-400" : "bg-emerald-400"}`}
                  style={{ width: `${(pwScore / 5) * 100}%` }}
                />
              </div>
              <div className="text-[11px] text-muted mt-1">
                Use letters, numbers, and symbols for a stronger password.
              </div>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <input
                id="confirm"
                type={showPw ? "text" : "password"}
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => markTouched("confirm")}
                placeholder="Re-enter password"
                required
              />
              <FieldError>
                {touched.confirm && confirm && password !== confirm ? "Passwords don’t match." : ""}
              </FieldError>
            </div>
          </div>
        </div>

        {/* Agreements / actions */}
        <div className="flex flex-col gap-3">
          <Toggle
            id="marketing"
            checked={marketingOptin}
            onChange={setMarketingOptin}
            label="Send me product updates & tips (optional)"
          />
          <div className="flex items-center gap-2">
            <input
              id="agree"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <label htmlFor="agree" className="text-sm text-muted">
              I agree to the <a href="/terms" className="underline">Terms</a> and{" "}
              <a href="/privacy" className="underline">Privacy Policy</a>.
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={submitting}
              className="rounded-lg px-4 py-2 font-semibold text-bg bg-gradient-to-br from-cyan-300 to-purple-500 disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
            <span className="text-muted text-sm">Plan: {planCode.toUpperCase()}</span>
          </div>
        </div>
      </form>

      {/* Module picker modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="glass rounded-2xl p-5 max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="Add modules"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">Add modules</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1 rounded-lg glass border border-border"
              >
                Done
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalog.map((m) => {
                const code = m.code || m.id || (m.name || "").toLowerCase().replace(/\s+/g, "-");
                const on = selected.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggleModule(code)}
                    className={`glass rounded-xl p-4 text-left border border-border transition-shadow hover:shadow-md ${
                      on ? "ring-2 ring-cyan-300/40" : ""
                    }`}
                    aria-pressed={on}
                  >
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-[11px] text-muted uppercase">{m.category || "other"}</div>
                    <p className="text-muted mt-1 line-clamp-3">{m.description}</p>
                    <div className="mt-3 text-sm">{on ? "✓ Selected" : "Add"}</div>
                  </button>
                );
              })}
              {catalog.length === 0 && (
                <div className="text-muted">No modules available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
