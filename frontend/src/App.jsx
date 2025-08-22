// ---------- FILE: src/App.jsx ----------
import React from "react";
import "./index.css";
import "./styles.css";
import "./styles/theme.css";
import "./styles/sidebar-skin.css";
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

/* -------- CRM: Extras -------- */
import { crmExtraRoutes } from "@/pages/crm/routes.extra";
import { crmCompanyRoutes } from "@/pages/crm/companies/routes.companies";

/* -------- Leads Scheduler (new) -------- */
const LeadsCalendarPage = React.lazy(() => import("@/pages/crm/LeadsCalendarPage.jsx"));

/* -------- Admin pages: all wired -------- */
const OrganizationProfile = React.lazy(() => import("@/pages/OrganizationProfile.jsx"));
const BrandingTheme       = React.lazy(() => import("@/pages/BrandingTheme.jsx"));
const Localization        = React.lazy(() => import("@/pages/Localization.jsx"));
const TaxCompliance       = React.lazy(() => import("@/pages/TaxCompliance.jsx"));
const BusinessUnitsDepts  = React.lazy(() => import("@/pages/BusinessUnitsDepts.jsx"));
const Locations           = React.lazy(() => import("@/pages/Locations.jsx"));
const CalendarsHolidays   = React.lazy(() => import("@/pages/CalendarsHolidays.jsx"));
const NumberingSchemes    = React.lazy(() => import("@/pages/NumberingSchemes.jsx"));
const CompliancePolicies  = React.lazy(() => import("@/pages/CompliancePolicies.jsx"));

/* -------- Admin: RBAC & Security -------- */
const AdminUsers         = React.lazy(() => import("@/pages/AdminUsers.jsx"));
const AdminRoles         = React.lazy(() => import("@/pages/AdminRoles.jsx"));
const PermissionsMatrix  = React.lazy(() => import("@/pages/PermissionsMatrix.jsx"));
const TeamsTerritories   = React.lazy(() => import("@/pages/TeamsTerritories.jsx"));
const SecurityPolicies   = React.lazy(() => import("@/pages/SecurityPolicies.jsx"));
const SsoMfa             = React.lazy(() => import("@/pages/SsoMfa.jsx"));
const Domains            = React.lazy(() => import("@/pages/Domains.jsx"));
const AuditLogs          = React.lazy(() => import("@/pages/AuditLogs.jsx"));

/* -------- Admin: Data & Customization -------- */
const AdminSettings      = React.lazy(() => import("@/pages/AdminSettings.jsx"));
const CustomFields       = React.lazy(() => import("@/pages/admin/CustomFieldsPage.jsx"));
const CustomForms       = React.lazy(() => import("@/pages/admin/CustomFormsPage.jsx"));
const PipelinesStages    = React.lazy(() => import("@/pages/PipelinesStages.jsx"));
const TemplatesAdmin     = React.lazy(() => import("@/pages/TemplatesAdmin.jsx"));
const NotificationsAdmin = React.lazy(() => import("@/pages/NotificationsAdmin.jsx"));
const ImportExport       = React.lazy(() => import("@/pages/ImportExport.jsx"));
const BackupsAdmin       = React.lazy(() => import("@/pages/BackupsAdmin.jsx"));

/* -------- Admin: Integrations & Developer -------- */
const IntegrationsAdmin  = React.lazy(() => import("@/pages/IntegrationsAdmin.jsx"));
const MarketplaceAdmin   = React.lazy(() => import("@/pages/MarketplaceAdmin.jsx"));
const ApiKeysAdmin       = React.lazy(() => import("@/pages/ApiKeysAdmin.jsx"));
const WebhooksAdmin      = React.lazy(() => import("@/pages/WebhooksAdmin.jsx"));
const FeatureFlagsAdmin  = React.lazy(() => import("@/pages/FeatureFlagsAdmin.jsx"));

/* -------- Admin: AI & Automation -------- */
const AiSettings         = React.lazy(() => import("@/pages/AiSettings.jsx"));
const AutomationRules    = React.lazy(() => import("@/pages/AutomationRules.jsx"));
const AdminApprovals     = React.lazy(() => import("@/pages/AdminApprovals.jsx"));

/* -------- Admin: Billing & Observability -------- */
const BillingSubscription= React.lazy(() => import("@/pages/BillingSubscription.jsx"));
const UsageLimits        = React.lazy(() => import("@/pages/UsageLimits.jsx"));
const SystemLogs         = React.lazy(() => import("@/pages/SystemLogs.jsx"));

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
        <div className="text-2l font-bold">✅ Health OK</div>
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

            {/* ADMIN — all pages wired under /app/admin/* */}
            <Route
              path="admin/*"
              element={<div className="min-h-[calc(100vh-56px)] p-6 md:p-8"><Outlet /></div>}
            >
              <Route index element={<Navigate to="org" replace />} />

              {/* Organization & Compliance */}
              <Route
                path="org"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Organization Profile…" />}>
                    <OrganizationProfile />
                  </React.Suspense>
                }
              />
              <Route
                path="branding"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Branding / Theme…" />}>
                    <BrandingTheme />
                  </React.Suspense>
                }
              />
              <Route
                path="localization"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Localization…" />}>
                    <Localization />
                  </React.Suspense>
                }
              />
              <Route
                path="taxes"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Tax & Compliance…" />}>
                    <TaxCompliance />
                  </React.Suspense>
                }
              />
              <Route
                path="units"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Business Units & Depts…" />}>
                    <BusinessUnitsDepts />
                  </React.Suspense>
                }
              />
              <Route
                path="locations"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Locations…" />}>
                    <Locations />
                  </React.Suspense>
                }
              />
              <Route
                path="calendars"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Calendars & Holidays…" />}>
                    <CalendarsHolidays />
                  </React.Suspense>
                }
              />
              <Route
                path="numbering"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Numbering Schemes…" />}>
                    <NumberingSchemes />
                  </React.Suspense>
                }
              />
              <Route
                path="compliance"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Compliance Policies…" />}>
                    <CompliancePolicies />
                  </React.Suspense>
                }
              />

              {/* Access Control (RBAC) */}
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
                path="permissions"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Permissions Matrix…" />}>
                    <PermissionsMatrix />
                  </React.Suspense>
                }
              />
              <Route
                path="teams"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Teams & Territories…" />}>
                    <TeamsTerritories />
                  </React.Suspense>
                }
              />

              {/* Security & Compliance */}
              <Route
                path="security"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Security Policies…" />}>
                    <SecurityPolicies />
                  </React.Suspense>
                }
              />
              <Route
                path="sso"
                element={
                  <React.Suspense fallback={<Fallback label="Loading SSO & MFA…" />}>
                    <SsoMfa />
                  </React.Suspense>
                }
              />
              <Route
                path="domains"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Domains…" />}>
                    <Domains />
                  </React.Suspense>
                }
              />
              <Route
                path="audit"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Audit Logs…" />}>
                    <AuditLogs />
                  </React.Suspense>
                }
              />

              {/* Data & Customization */}
              <Route path="settings"       element={<React.Suspense fallback={<Fallback label="Loading Settings…" />}><AdminSettings /></React.Suspense>} />
              <Route path="custom-fields"  element={<React.Suspense fallback={<Fallback label="Loading Custom Fields…" />}><CustomFields /></React.Suspense>} />
              <Route path="custom-forms"  element={<React.Suspense fallback={<Fallback label="Loading Custom Forms…" />}><CustomForms /></React.Suspense>} />
              <Route path="pipelines"      element={<React.Suspense fallback={<Fallback label="Loading Pipelines & Stages…" />}><PipelinesStages /></React.Suspense>} />
              <Route path="templates"      element={<React.Suspense fallback={<Fallback label="Loading Templates…" />}><TemplatesAdmin /></React.Suspense>} />
              <Route path="notifications"  element={<React.Suspense fallback={<Fallback label="Loading Notifications…" />}><NotificationsAdmin /></React.Suspense>} />
              <Route path="import"         element={<React.Suspense fallback={<Fallback label="Loading Import / Export…" />}><ImportExport /></React.Suspense>} />
              <Route path="backups"        element={<React.Suspense fallback={<Fallback label="Loading Backups…" />}><BackupsAdmin /></React.Suspense>} />

              {/* Integrations & Developer */}
              <Route path="integrations"   element={<React.Suspense fallback={<Fallback label="Loading Integrations…" />}><IntegrationsAdmin /></React.Suspense>} />
              <Route path="marketplace"    element={<React.Suspense fallback={<Fallback label="Loading Marketplace…" />}><MarketplaceAdmin /></React.Suspense>} />
              <Route path="api-keys"       element={<React.Suspense fallback={<Fallback label="Loading API Keys…" />}><ApiKeysAdmin /></React.Suspense>} />
              <Route path="webhooks"       element={<React.Suspense fallback={<Fallback label="Loading Webhooks…" />}><WebhooksAdmin /></React.Suspense>} />
              <Route path="features"       element={<React.Suspense fallback={<Fallback label="Loading Feature Flags…" />}><FeatureFlagsAdmin /></React.Suspense>} />

              {/* AI & Automation */}
              <Route path="ai"             element={<React.Suspense fallback={<Fallback label="Loading AI Settings…" />}><AiSettings /></React.Suspense>} />
              <Route path="automation"     element={<React.Suspense fallback={<Fallback label="Loading Automation Rules…" />}><AutomationRules /></React.Suspense>} />
              <Route path="approvals"      element={<React.Suspense fallback={<Fallback label="Loading Approvals…" />}><AdminApprovals /></React.Suspense>} />

              {/* Billing & Observability */}
              <Route path="billing"        element={<React.Suspense fallback={<Fallback label="Loading Billing & Subscription…" />}><BillingSubscription /></React.Suspense>} />
              <Route path="usage"          element={<React.Suspense fallback={<Fallback label="Loading Usage & Limits…" />}><UsageLimits /></React.Suspense>} />
              <Route path="logs"           element={<React.Suspense fallback={<Fallback label="Loading System Logs…" />}><SystemLogs /></React.Suspense>} />

              <Route path="*" element={<Navigate to="org" replace />} />
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
                path="leads/calendar"
                element={
                  <React.Suspense fallback={<Fallback label="Loading Lead Scheduler…" />}>
                    <LeadsCalendarPage />
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
               
                <Route path="plans"       element={<React.Suspense fallback={<Fallback label="Loading Plans…" />}><PlansPage /></React.Suspense>} />
                <Route path="rules"       element={<React.Suspense fallback={<Fallback label="Loading Rules…" />}><RulesPage /></React.Suspense>} />
                <Route path="tiers"       element={<React.Suspense fallback={<Fallback label="Loading Tiers…" />}><TiersPage /></React.Suspense>} />
                <Route path="programs"    element={<React.Suspense fallback={<Fallback label="Loading Programs…" />}><ProgramsPage /></React.Suspense>} />
                <Route path="payouts"     element={<React.Suspense fallback={<Fallback label="Loading Payouts…" />}><PayoutsPage /></React.Suspense>} />
                <Route path="adjustments" element={<React.Suspense fallback={<Fallback label="Loading Adjustments…" />}><AdjustmentsPage /></React.Suspense>} />
                <Route path="approvals"   element={<React.Suspense fallback={<Fallback label="Loading Approvals…" />}><ApprovalsPage /></React.Suspense>} />
                <Route path="reports"     element={<React.Suspense fallback={<Fallback label="Loading Reports…" />}><ReportsPage /></React.Suspense>} />
                <Route path="audit"       element={<React.Suspense fallback={<Fallback label="Loading Audit…" />}><AuditPage /></React.Suspense>} />
               
              </Route>

              {/* Keep your extra CRM route injections */}
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

          {/* Redirect helpers- */}
          <Route path="/dashboard/app/*" element={<Navigate to="/app" replace />} />
          {/* Menu paths without /app prefix → redirect to /app */}
          <Route path="/crm" element={<Navigate to="/app/crm" replace />} />
          <Route path="/crm/leads" element={<Navigate to="/app/crm/leads" replace />} />
          <Route path="/crm/leads/calendar" element={<Navigate to="/app/crm/leads/calendar" replace />} />

          <Route path="*" element={<Navigate to="/health" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
}
