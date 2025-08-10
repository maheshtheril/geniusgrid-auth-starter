// 📁 src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  LightBulbIcon,
} from "@heroicons/react/24/solid";
import axios from "axios";

export default function SignupWizard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract initial params
  const queryParams = new URLSearchParams(location.search);
  const initialModules = queryParams.get("modules")
    ? queryParams.get("modules").split(",")
    : [];
  const initialPlan = queryParams.get("plan") || "Free";

  // State
  const [step, setStep] = useState(1);
  const [modules, setModules] = useState(initialModules);
  const [plan] = useState(initialPlan);
  const [company, setCompany] = useState({
    name: "",
    domain: "",
    industry: "",
    country: "",
  });
  const [admin, setAdmin] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loadingAI, setLoadingAI] = useState(false);

  // Navigation
  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Toggle modules
  const handleModuleToggle = (mod) => {
    setModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  // AI Suggestions
  const fetchAISuggestions = async () => {
    if (!company.industry) {
      setErrors({ industry: "Enter industry first" });
      return;
    }
    setLoadingAI(true);
    try {
      const res = await axios.post("/api/ai/module-suggestions", {
        industry: company.industry,
      });
      const aiModules = res.data.suggestions || [];
      setModules((prev) => Array.from(new Set([...prev, ...aiModules])));
    } catch (err) {
      console.error("AI suggestion failed", err);
      alert("AI suggestion failed");
    } finally {
      setLoadingAI(false);
    }
  };

  // Validation
  const validateStep = () => {
    let stepErrors = {};
    if (step === 2) {
      if (!company.name) stepErrors.name = "Company name is required";
      if (!company.domain) stepErrors.domain = "Domain is required";
      if (!company.industry) stepErrors.industry = "Industry is required";
      if (!company.country) stepErrors.country = "Country is required";
    }
    if (step === 3) {
      if (!admin.name) stepErrors.name = "Full name is required";
      if (!admin.email) stepErrors.email = "Email is required";
      if (!admin.password) stepErrors.password = "Password is required";
      if (admin.password !== admin.confirmPassword)
        stepErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Submit
  const handleSubmit = async () => {
    if (!validateStep()) return;
    try {
      await axios.post("/api/public/start-signup", {
        modules,
        plan,
        company,
        admin,
      });
      navigate("/login?signup=success");
    } catch (err) {
      console.error("Signup failed", err);
      alert("Signup failed. Please try again.");
    }
  };

  // Step UI
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Select Modules</h2>
            <p className="text-gray-500 mb-3">
              These modules are based on your initial choice. Add or remove as needed.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {["CRM", "Sales", "Inventory", "HR", "Accounting"].map((mod) => (
                <button
                  key={mod}
                  onClick={() => handleModuleToggle(mod)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    modules.includes(mod)
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {modules.includes(mod) && (
                    <CheckCircleIcon className="inline h-4 w-4 mr-1" />
                  )}
                  {mod}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={fetchAISuggestions}
              disabled={loadingAI}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
            >
              <LightBulbIcon className="h-5 w-5" />
              {loadingAI ? "Thinking..." : "AI Suggest Modules"}
            </button>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Company Details</h2>
            {["name", "domain", "industry", "country"].map((field) => (
              <div key={field} className="mb-3">
                <input
                  type="text"
                  placeholder={
                    field === "name"
                      ? "Company Name"
                      : `Company ${field.charAt(0).toUpperCase() + field.slice(1)}`
                  }
                  value={company[field]}
                  onChange={(e) =>
                    setCompany({ ...company, [field]: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors[field] && (
                  <p className="text-red-500 text-sm">{errors[field]}</p>
                )}
              </div>
            ))}
          </div>
        );

      case 3:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Admin Account</h2>
            {["name", "email", "password", "confirmPassword"].map((field) => (
              <div key={field} className="mb-3">
                <input
                  type={field.toLowerCase().includes("password") ? "password" : "text"}
                  placeholder={
                    field === "name"
                      ? "Full Name"
                      : field === "email"
                      ? "Email"
                      : field === "password"
                      ? "Password"
                      : "Confirm Password"
                  }
                  value={admin[field]}
                  onChange={(e) =>
                    setAdmin({ ...admin, [field]: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors[field] && (
                  <p className="text-red-500 text-sm">{errors[field]}</p>
                )}
              </div>
            ))}
          </div>
        );

      case 4:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Review & Confirm</h2>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p><strong>Modules:</strong> {modules.join(", ")}</p>
              <p><strong>Plan:</strong> {plan}</p>
              <p><strong>Company:</strong> {company.name} ({company.industry})</p>
              <p><strong>Admin:</strong> {admin.name} ({admin.email})</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <div className="bg-white shadow-lg rounded-lg w-full max-w-2xl p-6">
        {/* Stepper */}
        <div className="flex mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`flex-1 h-2 mx-1 rounded transition-all ${
                step >= n ? "bg-blue-600" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {renderStep()}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center gap-1 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Back
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => validateStep() && nextStep()}
              className="ml-auto flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Next <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Create Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
