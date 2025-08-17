// ---------- FILE: src/App.jsx ----------
import React from "react";
import "./index.css";
import "./styles.css";
import "./styles/theme.css";

import { Routes, Route, Navigate, Link, Outlet } from "react-router-dom";

/* -------- Lazy: Public pages -------- */
const LoginPage    = React.lazy(() => import("./pages/LoginPage.jsx"));
const Signup       = React.lazy(() => import("./pages/Signup.jsx"));
const VerifyEmail  = React.lazy(() => import("./pages/VerifyEmail.jsx"));

/* -------- Core layout/pages -------- */
const ProtectedShell = React.lazy(() => import("./layouts/ProtectedShell.jsx"));
const DashboardPage  = React.lazy(() => import("./pages/DashboardPage.jsx"));
const LeadsPage      = React.lazy(() => import("./pages/LeadsPage.jsx"));
const CompaniesPage  = React.lazy(() => import("./pages/CompaniesPage.jsx"));

/* -------- Leads extras -------- */
const LeadCreate    = React.lazy(() => import("@/pages/LeadCreate.jsx"));
const DiscoverLeads = React.lazy(() => import("@/pages/leads/DiscoverLeads.jsx"));
const ImportReview  = React.lazy(() => import("@/pages/leads/ImportReview.jsx"));

/* -------- CRM: Deals (lazy) -------- */
const DealsLayout   = React.lazy(() => import("@/pages/crm/deals/DealsLayout.jsx"));
const DealsPipeline = React.lazy(() => import("@/pages/crm/deals/DealsPipeline.jsx"));
const DealsList     = React.lazy(() => import("@/pages/crm/deals/DealsList.jsx"));

/* -------- CRM: Incentives (lazy) -------- */
const IncentivesLayout        = React.lazy(() => import("@/pages/crm/incentives/IncentivesLayout.jsx"));
const IncentivesIndexRedirect = React.lazy(() => import("@/pages/crm/incentives/IndexRedirect.jsx"));
const PlansPage       = React.lazy(() => import("@/pages/crm/incentives/PlansPage").then(m => ({ default: m.PlansPage })));
const RulesPage       = React.lazy(() => import("@/pages/crm/incentives/RulesPage").then(m => ({ default: m.RulesPage })));
const TiersPage       = React.lazy(() => import("@/pages/crm/incentives/TiersPage").then(m => ({ default: m.TiersPage })));
const ProgramsPage    = React.lazy(() => import("@/pages/crm/incentives/ProgramsPage").then(m => ({ default: m.ProgramsPage })));
const PayoutsPage     = React.lazy(() => import("@/pages/crm/incentives/PayoutsPage").then(m => ({ default: m.PayoutsPage })));
const AdjustmentsPage = React.lazy(() => import("@/pages/crm/incentives/AdjustmentsPage").then(m => ({ default: m.AdjustmentsPage })));
const ApprovalsPage   = React.lazy(() => import("@/pages/crm/incentives/ApprovalsPage").then(m => ({ default: m.ApprovalsPage })));
const ReportsPage     = React.lazy(() => import("@/pages/crm/incentives/ReportsPage").then(m => ({ default: m.ReportsPage })));
const AuditPage       = React.lazy(() => import("@/pages/crm/incentives/AuditPage").then(m => ({ default: m.AuditPage })));

/* -------- CRM: Extras (keep as you had them) -------- */
import { crmExtraRoutes } from "@/pages/crm/routes.extra";
import { crmCompanyRoutes } from "@/pages/crm/companies/routes.companies";

/* -------- Admin (inline, no separate routes.jsx) -------- */
const AdminLayout = () => (
  <div className="min-h-[calc(100vh-56px)] p-4 md:p-6">
    <div className="mb-4 text-xl font-semibold">Admin</div>
    <Outlet />
  </div>
);
const AdminUsers     = React.lazy(() => import("@/pages/admin/users/UsersPage.jsx").catch(() => ({ default: () => <div>👤 Users</div> })));
const AdminRoles     = React.lazy(() => import("@/pages/admin/roles/RolesPage.jsx").catch(() => ({ default: () => <div>🔐 Roles & Permissions</div> })));
const AdminSettings  = React.lazy(() => import("@/pages/admin/settings/SettingsPage.jsx").catch(() => ({ default: () => <div>⚙️ System Settings</div> })));
const AdminAuditLogs = React.lazy(() => import("@/pages/admin/audit/AuditLogsPage.jsx").catch(() => ({ default: () => <div>📜 Audit Logs</div> })));

/* ---------- Error boundary ---------- */
class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Render error:", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0B0D10] text-gray-200 grid place-items-center p-6">
        <div className="max-w-2xl">
          <div className="text-2xl font-bold mb-2">❌ UI crashed</div>
        <pre className="whitespace-pre-wrap text-sm opacity-80">
{String(this.state.error?.stack || this.state.error?.message || this.state.error)}
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

/* ---------- Small utility components ---------- */
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

const CrmOutlet = () => <Outlet />;
const Fallback = ({ label = "Loading…" }) => (
  <div className="p-6 text-sm text-muted-foreground">{label}</div>
);

export default function App() {
  return (
    <div className="min-h-screen bg-[#0B0D10] text-gray-200">
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <React.Suspense fallback={<Fallback label="Loading Login…" />}>
                <LoginPage />
              </React.Suspense>
            }
          />
          <Route
            path="/signup"
            element={
              <React.Suspense fallback={<Fallback label="Loading Signup…" />}>
                <Signup />
              </React.Suspense>
            }
          />
          <Route
            path="/verify-email"
            element={
              <React.Suspense fallback={<Fallback label="Verifying email…" />}>
                <VerifyEmail />
              </React.Suspense>
            }
          />
          <Route path="/health" element={<Health />} />

          {/* Protected: Dashboard branch */}
          <Route
            path="/dashboard/*"
            element={
              <React.Suspense fallback={<Fallback label="Loading Shell…" />}>
                <ProtectedShell />
              </React.Suspense>
            }
          >
            <Route
              index
              element={
                <React.Suspense fallback={<Fallback label="Loading Dashboard…" />}>
                  <DashboardPage />
                </React.Suspense>
              }
            />
            <Route
              path="companies"
              element={
                <React.Suspense fallback={<Fallback label="Loading Companies…" />}>
                  <CompaniesPage />
                </React.Suspense>
              }
            />
          </Route>

          {/* Protected: App branch */}
          <Route
            path="/app/*"
            element={
              <React.Suspense fallback={<Fallback label="Loading Shell…" />}>
                <ProtectedShell />
              </React.Suspense>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* ADMIN (inline) */}
            <Route
              path="admin/*"
              element={
                <React.Suspense fallback={<Fallback label="Loading Admin…" />}>
                  <AdminLayout />
                </React.Suspense>
              }
            >
              <Route index element={<Navigate to="users" replace />} />
              <Route
                path="users"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Users…" />}>
                    <AdminUsers />
                  </React.Suspense>
                }
              />
              <Route
                path="roles"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Roles…" />}>
                    <AdminRoles />
                  </React.Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Settings…" />}>
                    <AdminSettings />
                  </React.Suspense>
                }
              />
              <Route
                path="audit"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Audit…" />}>
                    <AdminAuditLogs />
                  </React.Suspense>
                }
              />
              <Route path="*" element={<Navigate to="users" replace />} />
            </Route>

            {/* CRM */}
            <Route path="crm" element={<CrmOutlet />}>
              {/* Leads */}
              <Route
                path="leads"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Leads…" />}>
                    <LeadsPage />
                  </React.Suspense>
                }
              />
              <Route
                path="leads/new"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Lead Create…" />}>
                    <LeadCreate />
                  </React.Suspense>
                }
              />
              <Route
                path="discover"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Discover…" />}>
                    <DiscoverLeads />
                  </React.Suspense>
                }
              />

              {/* Deals */}
              <Route
                path="deals"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Deals…" />}>
                    <DealsLayout />
                  </React.Suspense>
                }
              >
                <Route index element={<Navigate to="pipeline" replace />} />
                <Route
                  path="pipeline"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Pipeline…" />}>
                      <DealsPipeline />
                    </React.Suspense>
                  }
                />
                <Route
                  path="list"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Deals List…" />}>
                      <DealsList />
                    </React.Suspense>
                  }
                />
              </Route>

              {/* Incentives */}
              <Route
                path="incentives"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Incentives…" />}>
                    <IncentivesLayout />
                  </React.Suspense>
                }
              >
                <Route
                  index
                  element={
                    <React.Suspense fallback={<Fallback label="Loading…" />}>
                      <IncentivesIndexRedirect />
                    </React.Suspense>
                  }
                />
                <Route
                  path="plans"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Plans…" />}>
                      <PlansPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="rules"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Rules…" />}>
                      <RulesPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="tiers"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Tiers…" />}>
                      <TiersPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="programs"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Programs…" />}>
                      <ProgramsPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="payouts"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Payouts…" />}>
                      <PayoutsPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="adjustments"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Adjustments…" />}>
                      <AdjustmentsPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="approvals"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Approvals…" />}>
                      <ApprovalsPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Reports…" />}>
                      <ReportsPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="audit"
                  element={
                    <React.Suspense fallback={<Fallback label="Loading Audit…" />}>
                      <AuditPage />
                    </React.Suspense>
                  }
                />
              </Route>

              {/* Extras left exactly as you have them */}
              {crmExtraRoutes}
              {crmCompanyRoutes}
            </Route>

            {/* Non-CRM under /app */}
            <Route
              path="leads/imports/:id"
              element={
                <React.Suspense fallback={<Fallback label="Loading Import Review…" />}>
                  <ImportReview />
                </React.Suspense>
              }
            />
          </Route>

          {/* Redirect helpers */}
          <Route path="/dashboard/app/*" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/health" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}
