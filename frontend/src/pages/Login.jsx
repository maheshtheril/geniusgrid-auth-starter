// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";
import { getSelectedModules, clearSelectedModules } from "../lib/selection";
import { fetchEntitlements } from "../lib/entitlements";
import { api } from "../lib/api.js";
import TextInput from "../components/TextInput.jsx";

export default function Login() {
  const [tenantCode, setTenantCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      // 1) auth
      const { data } = await api.post("/api/auth/login", { email, password, tenantCode });
      setMsg("Logged in as " + (data?.user?.name || email));

      // 2) install modules the user picked
      const selected = getSelectedModules();
      if (selected.length) {
        await api.post("/modules/install", { selectedModules: selected }).catch(() => {});
        clearSelectedModules();
      }

      // 3) fetch entitlements (for menus/dashboard)
      const ent = await fetchEntitlements();
      // TODO: store `ent` in your state/context as needed

      // 4) go to home/dashboard
      navigate("/"); // or '/dashboard'
    } catch (err) {
      setMsg(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Scoped styles: guarantee 2 columns and visible logo panel */}
      <style>{`
        .auth-shell{min-height:100dvh;display:grid;grid-template-columns:1fr 1fr;background:var(--bg);color:var(--text);}
        @media (max-width: 767.98px){ .auth-shell{grid-template-columns:1fr} }
        .auth-left{display:flex;flex-direction:column;justify-content:center;padding:40px;background:linear-gradient(180deg,color-mix(in oklab,var(--panel) 92%, transparent),var(--panel));border-right:1px solid var(--border);}
        .brand-row{display:flex;align-items:center;gap:12px;margin-bottom:24px}
        .brand-title{font-weight:800;letter-spacing:.02em}
        .brand-sub{color:var(--muted);font-size:.9rem}
        .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
        .auth-right{display:flex;align-items:center;justify-content:center;padding:24px}
        .auth-card{width:100%;max-width:420px;border-radius:var(--radius-lg)}
        .help-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border);color:var(--muted);font-size:.9rem}
      `}</style>

      <div className="auth-shell">
        {/* LEFT: Company / logo panel */}
        <aside className="auth-left">
          <div>
            <div className="brand-row">
              {/* Put your logo in /public/images/, adjust the filename if needed */}
              <img
                src="/images/geniusgrid-logo.png"
                alt="Company"
                width="40"
                height="40"
                style={{ borderRadius: 8 }}
                loading="eager"
              />
              <div>
                <div className="brand-title">GeniusGrid</div>
                <div className="brand-sub">AI-Powered ERP Suite</div>
              </div>
            </div>

            <h1 style={{ fontSize: "1.8rem", fontWeight: 700, lineHeight: 1.2 }}>
              Operate at <span style={{ color: "var(--primary)" }}>enterprise speed</span>
            </h1>
            <p style={{ marginTop: 10, color: "var(--muted)" }}>
              Real-time pipelines. Role-based control. Effortless login with secure sessions.
            </p>

            <div className="chips">
              <span className="gg-chip">Multi-tenant</span>
              <span className="gg-chip">AI Insights</span>
              <span className="gg-chip">Real-time</span>
              <span className="gg-chip">Audit Logs</span>
            </div>
          </div>
        </aside>

        {/* RIGHT: Login form */}
        <main className="auth-right">
          <div className="gg-panel auth-card" style={{ padding: 24 }}>
            <div className="mb-4" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 22 }}>🔐</div>
              <div>
                <div style={{ fontWeight: 700 }}>Welcome back</div>
                <div className="gg-muted" style={{ fontSize: ".9rem" }}>Sign in to continue</div>
              </div>
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <TextInput
                label="Tenant Code (subdomain)"
                value={tenantCode}
                onChange={setTenantCode}
                placeholder="yourcompany"
              />
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
              />
              <TextInput
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />

              <button
                disabled={loading}
                className="gg-btn gg-btn-primary"
                style={{ height: 40, width: "100%" }}
                type="submit"
                aria-busy={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

              {msg && (
                <p className="gg-muted" style={{ marginTop: 4 }}>
                  {msg}
                </p>
              )}
            </form>

            <div className="help-row">
              <a href="/forgot-password" className="hover:underline">Forgot password?</a>
              <span>
                New here?{" "}
                <a className="hover:underline" href="/signup" style={{ color: "var(--text)" }}>
                  Create account
                </a>
              </span>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
