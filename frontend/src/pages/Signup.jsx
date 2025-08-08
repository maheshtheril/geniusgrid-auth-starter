import React, { useState } from 'react';
import { api } from '../lib/api.js';
import TextInput from '../components/TextInput.jsx';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const { data } = await api.post('/api/public/signup', {
        fullName, email, password, companyName, subdomain, acceptTerms,
      });
      setMsg(data.message || 'Signed up. Check your email to verify.');
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h3 style={{ marginBottom: 12 }}>Create your tenant</h3>
      <TextInput label="Full Name" value={fullName} onChange={setFullName} />
      <TextInput label="Work Email" type="email" value={email} onChange={setEmail} />
      <TextInput label="Password" type="password" value={password} onChange={setPassword} />
      <TextInput label="Company Name" value={companyName} onChange={setCompanyName} />
      <TextInput label="Subdomain" value={subdomain} onChange={setSubdomain} placeholder="yourcompany" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 16px' }}>
        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
        <span>I accept the Terms</span>
      </label>
      <button disabled={loading} style={{ padding: '10px 16px', borderRadius: 6 }}>
        {loading ? 'Creating...' : 'Create account'}
      </button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </form>
  );
}
