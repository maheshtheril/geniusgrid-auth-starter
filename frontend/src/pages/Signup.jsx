// Signup.jsx — ERP frontend (production-grade)
// - Server is source of truth for modules via pre-signup `code`
// - Fallback to localStorage if code is absent
// - ETag-based refresh, focus refresh, and manual refresh
// - World-class form UX: react-hook-form + zod validation, a11y, pw strength

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";

const LS_KEY = "gg_selected_modules";
const LANDING_URL = import.meta.env.VITE_LANDING_URL || "/"; // e.g. https://geniusgrid.com

// ---------- Domain constants ----------
const COUNTRIES = [
  { code: "IN", name: "India", currency: "INR", tz: "Asia/Kolkata" },
  { code: "US", name: "United States", currency: "USD", tz: "America/New_York" },
  { code: "GB", name: "United Kingdom", currency: "GBP", tz: "Europe/London" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", tz: "Asia/Dubai" },
  { code: "SG", name: "Singapore", currency: "SGD", tz: "Asia/Singapore" },
];
const LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];
const INDUSTRIES = [
  "Services", "Manufacturing", "Retail / eCommerce", "Healthcare",
  "IT / SaaS", "Finance", "Education", "Logistics", "Other",
];
const EMP_SIZE = ["1–5","6–20","21–50","51–200","201–500","501–1000","1000+"];

// ---------- Validation (Zod) ----------
const urlRx = /^https?:\/\/.+/i;
const schema = z.object({
  tenantName: z.string().min(1, "Please enter your company/tenant name."),
  website: z.string().optional().refine((v) => !v || urlRx.test(v), { message: "Website must start with http(s)://" }),
  industry: z.string().optional(),
  employees: z.string().optional(),
  gstVat: z.string().optional(),

  fullName: z.string().min(1, "Please enter your name."),
  email: z.string().email("Please enter a valid email."),
  phone: z.string().optional(),

  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal: z.string().optional(),
  country: z.string().min(2),

  language: z.string().min(1),
  timezone: z.string().min(1, "Enter a time zone (e.g. Asia/Kolkata)."),
  currency: z.string().min(1, "Enter a currency (e.g. INR)."),

  password: z.string().min(8, "Password must be at least 8 characters."),
  confirm: z.string().min(1, "Please confirm your password."),
  agree: z.boolean().refine((v) => v, { message: "Please accept the terms to continue." }),
  marketingOptin: z.boolean().optional(),
}).refine((data) => data.password === data.confirm, {
  path: ["confirm"],
  message: "Passwords do not match.",
});

function scorePassword(pw) {
  let s = 0; if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5);
}

// ---------- UI bits ----------
function Label({ htmlFor, children, hint }) {
  return (
    <div className="flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="text-sm text-muted">{children}</label>
      {hint ? <span className="text-[11px] text-muted/70">{hint}</span> : null}
    </div>
  );
}
function Field({ id, register, type="text", ...rest }) {
  return (
    <input
      id={id}
      type={type}
      className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
      {...register(id)}
      {...rest}
    />
  );
}
function Err({ children }) {
  return children ? <div className="text-xs text-red-300 mt-1">{children}</div> : null;
}
function Pill({ children }) {
  return <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm glass">{children}</span>;
}

// ---------- Modules source-of-truth helper ----------
async function fetchModulesByCode(apiClient, code, { etag } = {}) {
  // GET /public/pre-signup/:code -> { modules: string[], plan_code?: string }
  const controller = new AbortController();
  const headers = { Accept: "application/json" };
  if (etag) headers["If-None-Match"] = etag;
  const url = `/public/pre-signup/${encodeURIComponent(code)}`;
  try {
    const res = await apiClient.get(url, { signal: controller.signal, headers });
    // Axios folds headers; try both
    const newEtag = res.headers?.etag || res.headers?.ETag || null;
    const data = res.data || {};
    const modules = Array.isArray(data.modules) ? data.modules.filter(Boolean) : [];
    const plan = data.plan_code ? String(data.plan_code) : undefined;
    return { modules, plan, etag: newEtag, notModified: false };
  } catch (err) {
    // If server replies 304, axios throws? Depending on adapter. Be defensive.
    const status = err?.response?.status;
    if (status === 304) {
      return { modules: null, plan: undefined, etag, notModified: true };
    }
    // For other errors, surface as undefined so caller can fallback.
    return { error: true };
  }
}

// ---------- Component ----------
export default function Signup() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  // Query params from landing redirect
  const codeParam = sp.get("code") || undefined; // attribution + server source-of-truth
  const planParam = (sp.get("plan") || "free").toLowerCase();

  // Modules state (read-only here)
  const [modules, setModules] = useState([]);
  const [modulesEtag, setModulesEtag] = useState(null);
  const [planCode, setPlanCode] = useState(planParam);
  const [modulesStatus, setModulesStatus] = useState("idle"); // idle | loading | ok | error

  // Password UX
  const [showPw, setShowPw] = useState(false);
  const pwRef = useRef(null);
  const [capsOn, setCapsOn] = useState(false);

  // Load modules from server (preferred) or localStorage fallback
  const loadModules = useCallback(async (reason = "manual") => {
    if (codeParam) {
      setModulesStatus("loading");
      const res = await fetchModulesByCode(api, codeParam, { etag: modulesEtag });
      if (res?.error) {
        setModulesStatus("error");
      } else if (res?.notModified) {
        setModulesStatus("ok");
      } else if (res) {
        if (Array.isArray(res.modules)) setModules(res.modules);
        if (res.plan) setPlanCode(res.plan);
        if (typeof res.etag === "string") setModulesEtag(res.etag);
        setModulesStatus("ok");
      }
      return;
    }
    // Fallback: same-origin localStorage (landing & ERP on same domain) — if not, this yields empty
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      setModules(Array.isArray(arr) ? arr.filter(Boolean) : []);
      setModulesStatus("ok");
    } catch {
      setModules([]);
      setModulesStatus("error");
    }
  }, [codeParam, modulesEtag]);

  // Initial load
  useEffect(() => { loadModules("init"); }, [loadModules]);

  // Refresh modules when the tab regains focus (user returns from landing)
  useEffect(() => {
    const onFocus = () => loadModules("focus");
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadModules]);

  // Local caps-lock indicator for password fields
  useEffect(() => {
    const el = pwRef.current;
    if (!el) return;
    const handler = (e) => setCapsOn(!!(e.getModifierState && e.getModifierState("CapsLock")));
    el.addEventListener("keyup", handler);
    el.addEventListener("keydown", handler);
    return () => {
      el.removeEventListener("keyup", handler);
      el.removeEventListener("keydown", handler);
    };
  }, []);

  // Localization defaults from country
  const [country, setCountry] = useState("IN");
  const countryDefaults = useMemo(
    () => COUNTRIES.find((c) => c.code === country) || COUNTRIES[0],
    [country]
  );

  // ---------- react-hook-form setup ----------
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: "",
      website: "",
      industry: "",
      employees: "",
      gstVat: "",

      fullName: "",
      email: "",
      phone: "",

      street: "",
      city: "",
      state: "",
      postal: "",
      country: country,

      language: "en",
      timezone: countryDefaults.tz,
      currency: countryDefaults.currency,

      password: "",
      confirm: "",
      agree: false,
      marketingOptin: true,
    },
    mode: "onBlur",
  });

  // Keep country in RHF and update TZ/Currency sensibly when country changes
  useEffect(() => {
    setValue("country", country);
    // only populate timezone/currency if still empty
    if (!watch("timezone")) setValue("timezone", countryDefaults.tz);
    if (!watch("currency")) setValue("currency", countryDefaults.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const password = watch("password");
  const pwScore = scorePassword(password);

  // ---------- actions ----------
  function backToLanding() {
    const url = new URL(LANDING_URL, window.location.origin);
    url.searchParams.set("returnToModules", "1");
    // optional: include plan + code for continuity
    if (codeParam) url.searchParams.set("code", codeParam);
    if (planCode) url.searchParams.set("plan", planCode);
    window.location.href = url.toString();
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      // account
      tenantName: values.tenantName.trim(),
      website: values.website?.trim(),
      industry: values.industry || undefined,
      employees: values.employees || undefined,
      gstVat: values.gstVat?.trim() || undefined,
      // contact
      name: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone?.trim() || undefined,
      // address
      address: {
        street: values.street?.trim() || undefined,
        city: values.city?.trim() || undefined,
        state: values.state?.trim() || undefined,
        postal: values.postal?.trim() || undefined,
        country: values.country,
      },
      // localization
      language: values.language,
      timezone: values.timezone,
      currency: values.currency,
      // modules & plan
      selectedModules: modules,     // authoritative list
      planCode: planCode,
      code: codeParam,              // optional attribution
      // auth
      password: values.password,
      marketingOptin: !!values.marketingOptin,
    };

    await api.post("/public/signup", payload);
    nav("/verify-email");
  });

  // ---------- UI ----------
  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Create your GeniusGrid account</h1>
          <p className="text-muted mt-1">Free plan to start. Upgrade anytime.</p>
        </div>
        <button
          type="button"
          onClick={backToLanding}
          className="px-3 py-2 rounded-lg border border-border glass"
          title="Back to app selection"
        >
          ← Back to app selection
        </button>
      </div>

      {/* Modules panel */}
      <div className="glass rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">Selected modules</div>
          <div className="flex items-center gap-2">
            <span className="text-muted text-sm">Plan: {planCode.toUpperCase()}</span>
            <button
              type="button"
              onClick={() => loadModules("manual")}
              className="px-2 py-1 rounded-md border border-border glass text-sm"
              title="Refresh modules"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-3 min-h-[40px] flex flex-wrap gap-2 items-center">
          {modulesStatus === "loading" && <span className="text-muted text-sm">Loading…</span>}
          {modulesStatus !== "loading" && modules.length === 0 && (
            <span className="text-muted text-sm">No modules selected. Click “Back to app selection”.</span>
          )}
          {modules.map((m) => <Pill key={m}>{m}</Pill>)}
        </div>
        {modulesStatus === "error" && (
          <div className="text-xs text-amber-300 mt-2">
            Couldn’t fetch modules from server. We’ll continue without them.
          </div>
        )}
      </div>

      {/* Signup form */}
      <form onSubmit={onSubmit} className="glass rounded-xl p-5 mt-6 grid gap-6">
        {/* Company */}
        <div>
          <div className="text-sm font-semibold mb-2">Company</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tenantName">Company / Tenant</Label>
              <Field id="tenantName" register={register} placeholder="e.g. Acme Corp" />
              <Err>{errors.tenantName?.message}</Err>
            </div>
            <div>
              <Label htmlFor="website" hint="Optional">Website</Label>
              <Field id="website" register={register} placeholder="https://example.com" />
              <Err>{errors.website?.message}</Err>
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <select id="industry" className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2" {...register("industry")}>
                <option value="">Select…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="employees">Employees</Label>
              <select id="employees" className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2" {...register("employees")}>
                <option value="">Select…</option>
                {EMP_SIZE.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="gstVat">GST / VAT (optional)</Label>
              <Field id="gstVat" register={register} placeholder="e.g. 22AAAAA0000A1Z5" />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div>
          <div className="text-sm font-semibold mb-2">Contact</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Your Name</Label>
              <Field id="fullName" register={register} placeholder="e.g. Priya Sharma" />
              <Err>{errors.fullName?.message}</Err>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Field id="email" type="email" register={register} placeholder="you@company.com" />
              <Err>{errors.email?.message}</Err>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Field id="phone" register={register} placeholder="+91 98765 43210" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <div className="text-sm font-semibold mb-2">Address</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="street">Street</Label>
              <Field id="street" register={register} placeholder="Street address" />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Field id="city" register={register} placeholder="City" />
            </div>
            <div>
              <Label htmlFor="state">State / Province</Label>
              <Field id="state" register={register} placeholder="State" />
            </div>
            <div>
              <Label htmlFor="postal">Postal Code</Label>
              <Field id="postal" register={register} placeholder="PIN / ZIP" />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
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
              <select id="language" className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2" {...register("language")}>
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="timezone">Time zone</Label>
              <Field id="timezone" register={register} placeholder="e.g. Asia/Kolkata" />
              <Err>{errors.timezone?.message}</Err>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Field id="currency" register={register} placeholder="e.g. INR" />
              <Err>{errors.currency?.message}</Err>
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
                <Field id="password" type={showPw ? "text" : "password"} register={register} placeholder="Create a strong password" ref={pwRef} />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted px-2 py-1 rounded-md border border-border glass"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              {capsOn && <div className="text-[11px] text-amber-300 mt-1">Caps Lock is ON.</div>}
              <div className="mt-2 h-2 rounded bg-white/10 overflow-hidden">
                <div
                  className={`h-2 ${pwScore <= 2 ? "bg-red-400" : pwScore === 3 ? "bg-yellow-400" : "bg-emerald-400"}`}
                  style={{ width: `${(pwScore / 5) * 100}%` }}
                />
              </div>
              <div className="text-[11px] text-muted mt-1">Use letters, numbers, and symbols for a stronger password.</div>
              <Err>{errors.password?.message}</Err>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Field id="confirm" type={showPw ? "text" : "password"} register={register} placeholder="Re-enter password" />
              <Err>{errors.confirm?.message}</Err>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" {...register("marketingOptin")} />
              <span className="text-sm text-muted">Send me product updates & tips (optional)</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" {...register("agree")} />
              <span className="text-sm text-muted">
                I agree to the <a href="/terms" className="underline">Terms</a> and{" "}
                <a href="/privacy" className="underline">Privacy Policy</a>.
              </span>
            </label>
            <Err>{errors.agree?.message}</Err>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-muted text-sm">Plan: {planCode.toUpperCase()}</div>
          <button
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 font-semibold text-bg bg-gradient-to-br from-cyan-300 to-purple-500 disabled:opacity-60"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}
