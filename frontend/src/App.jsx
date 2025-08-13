import React from "react";
import "./index.css";
import "./styles.css";
import "./styles/theme.css";

import { Routes, Route, Navigate, Link } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import Signup from "./pages/Signup.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ProtectedShell from "./layouts/ProtectedShell.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import CompaniesPage from "./pages/CompaniesPage.jsx";
import LeadCreate from "@/pages/LeadCreate.jsx"; // needs vite alias "@"
import DiscoverLeads from "@/pages/leads/DiscoverLeads.jsx";
import ImportReview from "@/pages/leads/ImportReview.jsx";

class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Render error:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0B0D10] text-gray-200 grid place-items-center p-6">
        <div className="max-w-2xl">
          <div className="text-2xl font-bold mb-2">❌ UI crashed</div>
          <pre className="whitespace-pre-wrap text-sm opacity-80">
            {String(
              this.state.error?.stack ||
                this.state.error?.message ||
                this.state.error
            )}
          </pre>
          <div className="mt-4 space-x-3 text-indigo-300 underline">
            <Link to="/login">/login</Link>
            <Link to="/app/crm/leads">/app/crm/leads</Link>
            <Link to="/dashboard">/dashboard</Link>
          </div>
        </div>
      </div>
    );
  }
}

function Health() {
  return (
    <div className="min-h-screen bg-[#0B0D10] text-gray-200 grid place-items-center">
      <div className="text-center">
        <div className="text-2xl font-bold">✅ Health OK</div>
        <div className="opacity-70 mb-4">Routing works.</div>
        <div className="space-x-2 underline">
          <Link to="/login">/login</Link>
          <Link to="/app/crm/leads">/app/crm/leads</Link>
          <Link to="/dashboard">/dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#0B0D10] text-gray-200">
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/health" element={<Health />} />

          {/* Protected branches */}
          <Route path="/dashboard/*" element={<ProtectedShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="companies" element={<CompaniesPage />} />
          </Route>

          <Route path="/app/*" element={<ProtectedShell />}>
            {/* 🔄 Changed default from Leads to Dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="crm/leads" element={<LeadsPage />} />
            <Route path="crm/leads/new" element={<LeadCreate />} />
            {/* ⬇️ AI pages now inside the shell */}
            <Route path="crm/discover" element={<DiscoverLeads />} />
            <Route path="leads/imports/:id" element={<ImportReview />} />
          </Route>

          {/* Redirects */}
          <Route
            path="/dashboard/app/*"
            element={<Navigate to="/app" replace />}
          />
          <Route path="*" element={<Navigate to="/health" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}
