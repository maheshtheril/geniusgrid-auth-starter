import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const LS_KEY = "gg_selected_modules";

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

export default function Signup() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const code = sp.get("code");

  // form
  const [tenantName, setTenantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);

  // modules
  const [catalog, setCatalog] = useState([]);          // from DB
  const [selected, setSelected] = useState(new Set()); // chosen modules
  const [planCode, setPlanCode] = useState("free");
  const [pickerOpen, setPickerOpen] = useState(false);

  // status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const selectedList = useMemo(() => Array.from(selected), [selected]);

  function toggleModule(code) {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    // Basic validations (feel free to adjust)
    if (!tenantName.trim()) return setError("Please enter your company/tenant name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!agree) return setError("Please accept the terms to continue.");

    setSubmitting(true);
    try {
      const payload = {
        tenantName: tenantName.trim(),
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        selectedModules: selectedList,    // backend can validate vs plan
        planCode,
        code,                              // optional: for attribution/analytics
      };
      await api.post("/public/signup", payload);
      // success → send user to verify email / or straight to login
      nav("/verify-email"); // or nav("/login");
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
    <div className="max-w-2xl mx-auto px-5 py-10">
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
      <form onSubmit={onSubmit} className="glass rounded-xl p-5 mt-6 grid gap-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted">Company / Tenant</label>
            <input
              className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
            />
          </div>
          <div>
            <label className="text-sm text-muted">Your Name</label>
            <input
              className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-muted">Email</label>
          <input
            type="email"
            className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted">Password</label>
            <input
              type="password"
              className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
            />
          </div>
          <div>
            <label className="text-sm text-muted">Confirm Password</label>
            <input
              type="password"
              className="w-full mt-1 rounded-lg border border-border bg-[#0f0f17] px-3 py-2 outline-none focus:ring-4 focus:ring-cyan-300/35"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
            />
            {confirm && password !== confirm && (
              <div className="text-xs text-red-300 mt-1">Passwords don’t match.</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="agree"
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <label htmlFor="agree" className="text-sm text-muted">
            I agree to the <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
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
      </form>

      {/* Module picker modal (simple glass dialog) */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="glass rounded-2xl p-5 max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
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
                const on = selected.has(m.code);
                return (
                  <button
                    key={m.code}
                    onClick={() => toggleModule(m.code)}
                    className={`glass rounded-xl p-4 text-left border border-border ${
                      on ? "ring-2 ring-cyan-300/40" : ""
                    }`}
                  >
                    <div className="font-semibold">{m.name}</div>
                    <div className="text-xs text-muted uppercase">{m.category}</div>
                    <p className="text-muted mt-1">{m.description}</p>
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
