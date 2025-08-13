// src/pages/LoginPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../styles.css";
import logoUrl from "../assets/geniusgrid-logo.png";

// --- unchanged helper ---
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

  const NEXT = "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 🔒 hidden but validated tenant
  const detectedTenant = useMemo(() => getSubdomainTenant(), []);
  const DEFAULT_TENANT =
    (import.meta.env.VITE_DEFAULT_TENANT || "").toLowerCase(); // note: may be ""

  const [tenant, setTenant] = useState(""); // start empty → validation will catch if unresolved

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Resolution order: ?tenant / subdomain / env default
    const resolved =
      (detectedTenant || DEFAULT_TENANT || "").toLowerCase().trim();
    if (resolved) {
      setTenant(resolved);
      try { localStorage.setItem("__gg_last_tenant", resolved); } catch {}
    } else {
      // leave tenant empty so validation blocks (same behavior as visible field before)
      setTenant("");
    }
  }, [detectedTenant]);

  function validate() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email";
    if (password.trim().length < 4) return "Password is required";
    // ✅ Tenant validation NOT affected (still required)
    if (!tenant || !tenant.trim()) return "Tenant code is required";
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
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort("timeout"), 15000);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: ctrl.signal,
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          tenant: tenant.trim().toLowerCase(), // 🔐 still sent
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
      <style>{`
        .login-shell{ min-height:100dvh; display:grid; grid-template-columns: 1fr; background: var(--bg); color: var(--text); }
        @media (min-width: 768px){ .login-shell{ grid-template-columns: 1fr 1fr; } .login-left{ display:flex; } }
        .login-left{ display:none; flex-direction: column; justify-content: center; padding: 40px;
          background: linear-gradient(180deg, color-mix(in oklab, var(--panel) 92%, transparent), var(--panel));
          border-right: 1px solid var(--border); }
        .login-right{ display:flex; align-items:center; justify-content:center; padding: 24px; }
        .login-card{ width: 100%; max-width: 420px; border-radius: var(--radius-lg); }
        .brand-row{ display:flex; align-items:center; gap:12px; margin-bottom:24px; }
        .brand-title{ font-weight:800; letter-spacing:.02em; }
        .brand-sub{ color: var(--muted); font-size:.9rem }
        .feature-chips{ display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
        .help-row{ display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; border-top:1px solid var(--border); color: var(--muted); font-size:.9rem; }
      `}</style>

      <div className="login-shell">
        <aside className="login-left">
          <div>
            <div className="brand-row">
              <img src={logoUrl} alt="GeniusGrid" width="80" height="80" style={{ borderRadius: 8 }} />
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
          </div>
        </aside>

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
              {/* Hidden but present → validation + submit unaffected */}
              <input type="hidden" name="tenant" value={tenant} />

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
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                      borderRadius: 8, padding: "4px 8px", color: "var(--muted)" }}
                    className="gg-btn-ghost"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((s) => !s)}
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

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
