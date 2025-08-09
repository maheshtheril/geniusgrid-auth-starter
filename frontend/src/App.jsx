import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Signup from './pages/Signup.jsx';
import Login from './pages/Login.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Landing from './pages/Landing';

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
         <Route path="/" element={<Landing />} />
        <Route path="/" element={<Signup />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    </div>
  );
}
