import React, { useEffect, useState } from "react";
const STORE_KEY = "sso_mfa_v1";
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5"><div className="text-base md:text-lg font-semibold">{title}</div>{desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}</div>
    {children}
  </section>
);
const Input = (p) => <input {...p} className={"w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " + (p.className||"")} />;

export default function SsoMfa(){
  const [cfg, setCfg] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch{} }
    return {
      enforce_sso: false, require_mfa: true, mfa_methods: { totp:true, sms:false, webauthn:true },
      mode: "OIDC", // OIDC | SAML
      oidc: { client_id:"", client_secret:"", discovery_url:"" },
      saml: { issuer:"", sso_url:"", certificate:"" },
      redirect_url: window.location.origin + "/auth/callback",
    };
  });
  useEffect(()=>{ localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); },[cfg]);
  const up = (patch)=> setCfg(prev => ({...prev,...patch}));

  const testSSO = ()=> alert("Mock: would redirect to IdP");

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="text-sm text-gray-400">Admin / Security & Compliance / SSO & MFA</div>
        <h1 className="text-2xl md:text-3xl font-bold">SSO & MFA</h1>
        <p className="text-sm text-gray-400 mt-1">Configure SAML/OIDC and enforcement rules.</p>
      </div>

      <Section title="Enforcement">
        <div className="grid md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input type="checkbox" checked={cfg.enforce_sso} onChange={(e)=>up({enforce_sso:e.target.checked})} />
            <span className="text-sm">Enforce SSO</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
            <input type="checkbox" checked={cfg.require_mfa} onChange={(e)=>up({require_mfa:e.target.checked})} />
            <span className="text-sm">Require MFA</span>
          </label>
          <div className="flex items-center gap-3">
            {["totp","sms","webauthn"].map(m => (
              <label key={m} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={cfg.mfa_methods[m]} onChange={(e)=>up({mfa_methods:{...cfg.mfa_methods,[m]:e.target.checked}})} /> {m.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Identity Provider">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Protocol</span>
            <select className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2" value={cfg.mode} onChange={(e)=>up({mode:e.target.value})}>
              <option>OIDC</option><option>SAML</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Redirect URL</span>
            <Input value={cfg.redirect_url} onChange={(e)=>up({redirect_url:e.target.value})}/>
          </label>

          {cfg.mode==="OIDC" ? (
            <>
              <label className="block"><span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Client ID</span><Input value={cfg.oidc.client_id} onChange={(e)=>up({oidc:{...cfg.oidc, client_id:e.target.value}})} /></label>
              <label className="block"><span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Client Secret</span><Input value={cfg.oidc.client_secret} onChange={(e)=>up({oidc:{...cfg.oidc, client_secret:e.target.value}})} /></label>
              <label className="block md:col-span-2"><span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Discovery URL</span><Input value={cfg.oidc.discovery_url} onChange={(e)=>up({oidc:{...cfg.oidc, discovery_url:e.target.value}})} /></label>
            </>
          ) : (
            <>
              <label className="block"><span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Issuer</span><Input value={cfg.saml.issuer} onChange={(e)=>up({saml:{...cfg.saml, issuer:e.target.value}})} /></label>
              <label className="block"><span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">SSO URL</span><Input value={cfg.saml.sso_url} onChange={(e)=>up({saml:{...cfg.saml, sso_url:e.target.value}})} /></label>
              <label className="block md:col-span-2"><span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Certificate</span><Input value={cfg.saml.certificate} onChange={(e)=>up({saml:{...cfg.saml, certificate:e.target.value}})} /></label>
            </>
          )}
        </div>

        <div className="mt-3">
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={testSSO}>Test SSO (mock)</button>
        </div>
      </Section>
    </div>
  );
}
