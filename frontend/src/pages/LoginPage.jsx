import React, { useEffect, useMemo, useState } from "react";
import "../styles.css";

/**
 * Multi-tenant login page
 * - Auto-detect tenant from subdomain (e.g., acme.app.com -> tenant="acme")
 * - Hide tenant field when detected; show a pill with a "Change" button
 * - Allow ?tenant= override for dev (localhost) or direct links
 * - Posts to /api/auth/login with credentials: "include"
 *
 * ENV:
 *   VITE_API_URL       — e.g., https://geniusgrid-auth-starter.onrender.com
 *   VITE_BASE_DOMAINS  — optional, comma-separated list of base domains to strip (e.g., "geniusgrid-web.onrender.com,geniusgrid.com")
 *                         If omitted, the code still works by taking the left-most label as subdomain (except localhost/ips)
 */

function getSubdomainTenant() {
  try {
    const urlTenant = new URLSearchParams(window.location.search).get("tenant");
    if (urlTenant) return urlTenant.trim().toLowerCase();

    const host = window.location.hostname; // e.g., acme.geniusgrid-web.onrender.com or localhost
    // Ignore localhost and IPs
    const isLocal =
      host === "localhost" ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      host.endsWith(".local");

    if (isLocal) return null;

    // If user provided known base domains, strip them
    const baseList = (import.meta.env.VITE_BASE_DOMAINS || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (baseList.length > 0) {
      for (const base of baseList) {
        if (host.toLowerCase().endsWith("." + base)) {
          // acme.base -> subdomain is everything before base
          const sub = host.slice(0, host.length - (base.length + 1));
          // take left-most label as tenant (e.g., "acme" from "acme.eu")
          const first = sub.split(".")[0];
          return first || null;
        }
        if (host.toLowerCase() === base) return null;
      }
    }

    // Fallback: take the left-most label as subdomain
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

  // Tenant detection & control
  const detectedTenant = useMemo(() => getSubdomainTenant(), []);
  const [tenant, setTenant] = useState("");
  const [tenantLocked, setTenantLocked] = useState(false); // when true, hide input and show chip

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Initialize tenant from: URL ?tenant => subdomain => localStorage
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
    setError(""); setMessage("");

    const problem = validate();
    if (problem) return setError(problem);

    setLoading(true);
    try {
      localStorage.setItem("__gg_last_tenant", tenant);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      setTimeout(() => (window.location.href = NEXT), 650);
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      {/* LEFT (50%) */}
      <div className="login-left">
        <div className="login-left-content">
          {/* Company logo only */}
          <div className="brand-row">
            <img
              src="/images/company-logo.png"
              alt="Company Logo"
              className="brand-logo"
              loading="eager"
            />
          </div>

          <h1 className="left-title">
            Operate at <span>enterprise speed</span>
          </h1>
          <p className="subtitle">
            Real-time pipelines. Role-based control. Effortless login with secure sessions.
          </p>

          <ul className="bullet-list">
            <li><i /> Multi-tenant & RBAC</li>
            <li><i /> AES-256 at rest</li>
            <li><i /> Uptime 99.99%</li>
          </ul>
        </div>
      </div>

      {/* RIGHT (50%) */}
      <div className="login-right">
        <div className="panel glass login-card">
          <div className="card-head">
            <div className="card-icon">🔐</div>
            <div>
              <div className="card-title">Welcome back</div>
              <div className="text-muted card-sub">Sign in to continue</div>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ position: "relative" }}>
              <label>Password</label>
              <input
                className="has-icon"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>

            {/* Tenant: show chip if locked, otherwise show input */}
            {tenantLocked ? (
              <div className="form-group">
                <label>Tenant</label>
                <div className="chip" style={{ justifyContent: "space-between", width: "100%" }}>
                  <span style={{ textTransform: "lowercase" }}>{tenant}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setTenantLocked(false)}
                    style={{ padding: "4px 10px", borderRadius: 10, fontWeight: 600 }}
                    aria-label="Change tenant"
                  >
                    Change
                  </button>
                </div>
                <div className="note">Detected from subdomain. Click Change to use a different tenant.</div>
              </div>
            ) : (
              <div className="form-group">
                <label>Tenant</label>
                <input
                  type="text"
                  placeholder="e.g., tenant1"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value.trim())}
                />
                <div className="note">Tip: add <code>?tenant=yourcode</code> to the URL or use a tenant subdomain.</div>
              </div>
            )}

            {error && <div className="alert error">{error}</div>}
            {message && <div className="alert ok">{message}</div>}

            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="card-foot">
            <a href="#" className="text-muted small">Forgot password?</a>
            <span className="text-muted small">New here? <a href="/signup">Create account</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}
