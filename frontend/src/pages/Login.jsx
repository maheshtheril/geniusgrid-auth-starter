import { getSelectedModules, clearSelectedModules } from '../lib/selection';
import { fetchEntitlements } from '../lib/entitlements';
import React, { useState } from 'react';
import { api } from '../lib/api.js';
import TextInput from '../components/TextInput.jsx';

export default function Login() {
  const [tenantCode, setTenantCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', { email, password, tenantCode });
      setMsg('Logged in as ' + data.user.name);
      // Optionally: call /api/auth/me here or navigate to your app
       // 2) install modules the user picked (Free plan allows crm/sales/inventory by default)
  const selected = getSelectedModules();
  if (selected.length) {
    await api.post('/modules/install', { selectedModules: selected }).catch(() => {});
    clearSelectedModules();
  }
    // 3) optionally fetch entitlements for building menus/dashboard
  const ent = await fetchEntitlements();
  // store ent in context/state as you like

  // 4) navigate to dashboard/home
  navigate('/'); // or '/dashboard'
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h3 style={{ marginBottom: 12 }}>Login</h3>
      <TextInput label="Tenant Code (subdomain)" value={tenantCode} onChange={setTenantCode} placeholder="yourcompany" />
      <TextInput label="Email" type="email" value={email} onChange={setEmail} />
      <TextInput label="Password" type="password" value={password} onChange={setPassword} />
      <button disabled={loading} style={{ padding: '10px 16px', borderRadius: 6 }}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </form>
  );
}
