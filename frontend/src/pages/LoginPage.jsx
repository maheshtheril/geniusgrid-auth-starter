import React, { useEffect, useMemo, useState } from "react";
import "../styles.css";

/**
 * Multi-tenant login page
 * - Auto-detect tenant from subdomain or ?tenant=
 * - Posts to /api/auth/login with credentials: "include"
 */

function getSubdomainTenant() {
  try {
    const urlTenant = new URLSearchParams(window.location.search).get("tenant");
    if (urlTenant) return urlTenant.trim().toLowerCase();

    const host = window.location.hostname;
    const isLocal =
      host === "localhost" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      host.endsWith(".local");
    if (isLocal) return null;

    const baseList = (import.meta.env.VITE_BASE_DOMAINS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (baseList.length > 0) {
      for (const base of baseList) {
        if (host.toLowerCase().endsWith("." + base)) {
          const sub = host.slice(0, host.length - (base.length + 1));
          const first = sub.split(".")[0];
          return first || null;
        }
        if (host.toLowerCase() === base) return null;
      }
    }

    const parts = host.split(".");
    if (parts.length >= 3) {
      const sub = parts[0];
      if (sub && sub !== "www") return sub.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const API_BASE = useMemo(
    () =>
      (import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
        "https://geniusgrid-auth-starter.onrender.com"),
    []
  );

  // If your app’s first screen is Leads, this is safer than /dashboard
  const NEXT = "/app/crm/leads"; // change to "/dashboard" if you prefer

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Tenant detection & control
  const detectedTenant = useMemo(() => getSubdomainTenant(), []);
  const [tenant, setTenant] = useState("");
  const [tenantLocked, setTenantLocked] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tenant");
    if (fromUrl) {
      setTenant(fromUrl.trim().toLowerCase());
      setTenantLocked(true);
      return;
    }
    if (detectedTenant) {
      setTenant(detectedTenant);
      setTenantLocked(true);
      return;
    }
    const saved = localStorage.getItem("__gg_last_tenant");
    if (saved) setTenant(saved);
  }, [detectedTenant]);

  function validate() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email";
    if (password.trim().length < 4) return "Password is required";
    if (!tenant.trim()) return "Tenant code is required";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);

    // Prevent “stuck forever”: abort after 15s
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort("timeout"), 15000);

    try {
      localStorage.setItem("__gg_last_tenant", tenant);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          tenant: tenant.trim().toLowerCase(),
        }),
      });

      // If CORS blocks, fetch rejects (caught below). If 4xx/5xx, we handle here.
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) setError(data?.message || "Invalid credentials or inactive user");
        else if (res.status === 400) setError(data?.message || "Missing fields");
        else setError(data?.message || `Login failed (${res.status})`);
        return;
      }

      setMessage("Login successful. Redirecting…");
      // Use location.assign to avoid SPA state weirdness
      setTimeout(() => window.location.assign(NEXT), 500);
    } catch (err) {
      console.error("Login error:", err);
      setError(err?.name === "AbortError" ? "Request timed out. Try again." : "Network error. Please try again.");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] grid grid-cols-1 md:grid-cols-2 bg-[var(--bg)] text-[color:var(--text)]">
      {/* LEFT */}
      <div className="hidden md:block">
        <div className="h-full p-10 flex flex-col justify-center">
          <div className="mb-8">
            <img
              src="/images/company-logo.png"
              alt="Company Logo"
              className="h-10 w-auto"
              loading="eager"
            />
          </div>

          <h1 className="text-3xl font-semibold">
            Operate at <span className="text-[color:var(--primary)]">enterprise speed</span>
          </h1>
          <p className="mt-3 text-[color:var(--muted)]">
            Real-time pipelines. Role-based control. Effortless login with secure sessions.
          </p>

          <ul className="mt-6 space-y-2 text-sm text-[color:var(--muted)]">
            <li>• Multi-tenant & RBAC</li>
            <li>• AES-256 at rest</li>
            <li>• Uptime 99.99%</li>
          </ul>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm rounded-2xl gg-panel p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="text-2xl">🔐</div>
            <div>
              <div className="text-lg font-semibold">Welcome back</div>
              <div className="text-sm text-[color:var(--muted)]">Sign in to continue</div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm text-[color:var(--muted)]">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="gg-input w-full rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-[color:var(--muted)]">Password</label>
              <div className="relative">
                <input
                  className="gg-input w-full rounded-md px-3 py-2 pr-10"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm text-[color:var(--muted)] hover:bg-[color:var(--border)]/30"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Tenant */}
            {tenantLocked ? (
              <div>
                <label className="mb-1 block text-sm text-[color:var(--muted)]">Tenant</label>
                <div className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--panel)] px-3 py-2">
                  <span className="lowercase">{tenant}</span>
                  <button
                    type="button"
                    className="gg-btn gg-btn-ghost border border-[color:var(--border)] px-3 py-1 rounded-md"
                    onClick={() => setTenantLocked(false)}
                    aria-label="Change tenant"
                  >
                    Change
                  </button>
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  Detected from subdomain. Click Change to use a different tenant.
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm text-[color:var(--muted)]">Tenant</label>
                <input
                  type="text"
                  placeholder="e.g., tenant1"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value.trim())}
                  className="gg-input w-full rounded-md px-3 py-2"
                  required
                />
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  Tip: add <code>?tenant=yourcode</code> to the URL or use a tenant subdomain.
                </div>
              </div>
            )}

            {error && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>}
            {message && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</div>}

            <button
              className="gg-btn w-full rounded-lg bg-[color:var(--primary)] px-4 py-2 text-white disabled:opacity-60"
              type="submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm text-[color:var(--muted)]">
            <a href="#" className="hover:underline">Forgot password?</a>
            <span>
              New here? <a className="text-[color:var(--text)] hover:underline" href="/signup">Create account</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
