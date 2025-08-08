import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [msg, setMsg] = useState('Verifying…');
  const token = params.get('token');
  const email = params.get('email');

  useEffect(() => {
    async function go() {
      if (!token || !email) {
        setMsg('Missing token or email.');
        return;
      }
      try {
        // We just call the backend verify endpoint by redirect - but for FE we can show helper
        // Backend actually handles the verify + redirect.
        // Here, we just inform the user what to do if not redirected automatically.
        await api.get('/api/public/verify-email', { params: { token, email } });
        setMsg('Email verified. You can now login.');
      } catch (e) {
        setMsg(e?.response?.data?.message || 'Verification failed');
      }
    }
    go();
  }, [token, email]);

  return (
    <div>
      <h3>Email Verification</h3>
      <p>{msg}</p>
      <p><Link to="/login">Go to login</Link></p>
    </div>
  );
}
