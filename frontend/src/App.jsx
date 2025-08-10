import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

import LoginPage from './pages/LoginPage.jsx';
import Signup from './pages/Signup.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
// (Temporarily remove Landing import to avoid confusion)
// import Landing from './pages/Landing.jsx';

export default function App() {
  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2>GeniusGrid</h2>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link to="/signup">Signup</Link>
          <Link to="/login">Login</Link>
        </nav>
      </header>

      <Routes>
        {/* TEMP: force root to show login */}
        <Route path="/" element={<LoginPage />} />

        {/* Keep these */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    </div>
  );
}
