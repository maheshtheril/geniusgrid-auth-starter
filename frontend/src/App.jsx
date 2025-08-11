import React from "react";
import "./styles.css";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import Signup from "./pages/Signup.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";


// Protected shell with sidebar + company switcher
import ProtectedShell from "./layouts/ProtectedShell.jsx";

// Example protected pages
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import CompaniesPage from "./pages/CompaniesPage.jsx";
import LeadCreate from "@/pages/LeadCreate.jsx";

export default function App() {
  return (
    <Routes>
      {/* ---------- Public Routes ---------- */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* ---------- Protected Routes ---------- */}
      <Route path="/dashboard" element={<ProtectedShell />}>
        <Route index element={<DashboardPage />} />
       <Route path="/app/crm/leads" element={<LeadsPage />} />
       <Route path="/app/crm/leads/new" element={<LeadCreate />} />
        <Route path="companies" element={<CompaniesPage />} />
        {/* add more protected routes here */}
      </Route>

      {/* Catch-all: redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
