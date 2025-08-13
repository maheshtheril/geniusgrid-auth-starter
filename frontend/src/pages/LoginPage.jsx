// src/pages/LoginPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../styles.css";
import logoUrl from "../assets/geniusgrid-logo.png"; // <-- BUNDLED ASSET

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
  const NEXT = "/app/crm/leads";

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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) setError(data?.message || "Invalid credentials or inactive user");
        else if (res.status === 400) setError(data?.message || "Missing fields");
        else setError(data?.message || `Login failed (${res.status})`);
        return;
      }

      setMessage("Login successful. Redirecting…");
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
    <>
      {/* Scoped CSS to enforce two-column layout without Tailwind */}
      <style>{`
        .login-shell{
          min-height:100dvh;
          display:grid;
          grid-template-columns: 1fr; /* mobile: stack */
          background: var(--bg);
          color: var(--text);
        }
        @media (min-width: 768px){
          .login-shell{
            grid-template-columns: 1fr 1fr; /* md+: two panels */
          }
          .login-left{ display:flex; }
        }
        .login-left{
          display:none; /* shown at md+ via media query */
          flex-direction: column;
          justify-content: center;
          padding: 40px;
          background: linear-gradient(180deg,
            color-mix(in oklab, var(--panel) 92%, transparent),
            var(--panel)
          );
          border-right: 1px solid var(--border);
        }
        .login-right{
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 24px;
        }
        .login-card{
          width: 100%;
          max-width: 420px;
          border-radius: var(--radius-lg);
        }
        .brand-row{
          display:flex; align-items:center; gap:12px; margin-bottom:24px;
        }
        .brand-title{ font-weight:800; letter-spacing:.02em; }
        .brand-sub{ color: var(--muted); font-size:.9rem }
        .feature-chips{ display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
        .help-row{
          display:flex; align-items:center; justify-content:space-between;
          padding: 12px 16px; border-top:1px solid var(--border);
          color: var(--muted); font-size:.9rem;
        }
      `}</style>

      <div className="login-shell">
        {/* LEFT: Brand / Logo panel */}
        <aside className="login-left">
          <div>
            <div className="brand-row">
              {/* 🔁 Replace src with your actual logo path */}
              <img
                src={logoUrl}
                alt="GeniusGrid"
                width="40"
                height="40"
                style={{ borderRadius: 8 }}
              />
              <div>
                <div className="brand-title">GeniusGrid</div>
                <div className="brand-sub">AI‑Powered ERP Suite</div>
              </div>
            </div>

            <h1 style={{ fontSize: "1.8rem", fontWeight: 700, lineHeight: 1.2 }}>
              Operate at <span style={{ color: "var(--primary)" }}>enterprise speed</span>
            </h1>
            <p style={{ marginTop: 10, color: "var(--muted)" }}>
              Real-time pipelines. Role-based control. Effortless login with secure sessions.
            </p>

            <div className="feature-chips">
              <span className="gg-chip">Multi‑tenant</span>
              <span className="gg-chip">AI Insights</span>
              <span className="gg-chip">Real‑time</span>
              <span className="gg-chip">Audit Logs</span>
            </div>

            <div style={{ marginTop: 24 }}>
              <div className="gg-surface p-3 rounded-lg" style={{ display: "grid", gap: 8 }}>
                <div className="gg-muted" style={{ fontSize: ".85rem" }}>
                  Need an account?
                </div>
                <a className="gg-btn gg-btn-primary" href="/signup" style={{ height: 40, width: "fit-content" }}>
                  Create account
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT: Form panel */}
        <main className="login-right">
          <div className="gg-panel login-card p-6">
            <div className="mb-4" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22 }}>🔐</div>
              <div>
                <div style={{ fontWeight: 700 }}>Welcome back</div>
                <div className="gg-muted" style={{ fontSize: ".9rem" }}>Sign in to continue</div>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="form-col">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="gg-input w-full"
                  required
                />
              </div>

              {/* Password */}
              <div className="form-col">
                <label className="form-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="gg-input w-full"
                    style={{ paddingRight: 44 }}
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      borderRadius: 8,
                      padding: "4px 8px",
                      color: "var(--muted)"
                    }}
                    className="gg-btn-ghost"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((s) => !s)}
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Tenant */}
              {tenantLocked ? (
                <div className="form-col">
                  <label className="form-label">Tenant</label>
                  <div
                    className="rounded-lg"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      padding: "8px 12px"
                    }}
                  >
                    <span className="lowercase">{tenant}</span> 
                   
                    <button
                      type="button"
                      className="gg-btn gg-btn-ghost"
                      style={{ padding: "6px 10px" }}
                      onClick={() => setTenantLocked(false)}
                      aria-label="Change tenant"
                    >
                      Change
                    </button>
                  </div>
                  <div className="gg-muted" style={{ fontSize: ".8rem", marginTop: 6 }}>
                    Detected from subdomain. Click Change to use a different tenant.
                  </div>
                </div>
              ) : (
                <div className="form-col">
                  <label className="form-label">Tenant</label>
                  <input
                    type="text"
                    placeholder="e.g., tenant1"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value.trim())}
                    className="gg-input w-full"
                    required
                  />
                  <div className="gg-muted" style={{ fontSize: ".8rem", marginTop: 6 }}>
                    Tip: add <code>?tenant=yourcode</code> to the URL or use a tenant subdomain.
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg" style={{ background: "rgba(244, 63, 94, .12)", color: "#fecdd3", padding: "8px 12px", fontSize: ".9rem" }}>
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-lg" style={{ background: "rgba(16, 185, 129, .12)", color: "#a7f3d0", padding: "8px 12px", fontSize: ".9rem" }}>
                  {message}
                </div>
              )}

              <button
                className="gg-btn gg-btn-primary w-full"
                style={{ height: 40 }}
                type="submit"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="help-row">
              <a href="/forgot-password" className="hover:underline">Forgot password?</a>
              <span>
                New here? <a className="hover:underline" href="/signup" style={{ color: "var(--text)" }}>Create account</a>
              </span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
