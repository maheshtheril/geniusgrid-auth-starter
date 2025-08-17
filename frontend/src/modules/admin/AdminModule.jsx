// Admin Module – World‑Class SaaS ERP Scaffold (React + Tailwind + shadcn/ui + lucide + framer-motion + recharts)
// ---------------------------------------------------------------------------------
// HOW TO WIRE (copy/paste):
// 1) Drop this file anywhere under src/, e.g. src/modules/admin/AdminModule.jsx
// 2) Ensure your project has these libs available: react-router-dom, lucide-react, framer-motion, recharts, shadcn/ui components,
//    and Tailwind. (This scaffold follows your project's style guides.)
// 3) In your App router, under the protected /app branch, mount the exported `adminRoutes`:
//    
//    import { adminRoutes } from "@/modules/admin/AdminModule";
//    ...
//    <Route path="/app/*" element={<ProtectedShell/>}>
//      ... your other routes ...
//      {adminRoutes}
//    </Route>
// 
// 4) In your sidebar, add a link to "/app/admin" (or nest within your existing menu system).
// 5) Replace temporary client-side state with your API calls later (marked with TODOs).
// ---------------------------------------------------------------------------------

import React from "react";
import { Routes, Route, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Settings,
  User,
  ShieldCheck,
  Building,
  Layers,
  Sliders,
  FileText,
  Bell,
  BarChart2,
  CreditCard,
  Globe,
  KeyRound,
  ShieldAlert,
  Database,
  Paintbrush,
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
} from "lucide-react";

// shadcn/ui imports (adjust paths if your alias differs)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

// ----------------------------- Layout & Menu ------------------------------------
const adminMenu = [
  { label: "Users", icon: User, to: "users", description: "Provision and manage users" },
  { label: "Roles & Permissions", icon: ShieldCheck, to: "roles", description: "RBAC with least-privilege" },
  { label: "Companies", icon: Building, to: "companies", description: "Legal entities & org details" },
  { label: "Tenants", icon: Layers, to: "tenants", description: "Multi-tenant controls" },
  { label: "System Settings", icon: Sliders, to: "settings", description: "Global configuration" },
  { label: "Audit Logs", icon: FileText, to: "audit", description: "Trace every critical action" },
  { label: "Notifications", icon: Bell, to: "notifications", description: "Email/SMS/webhooks" },
  { label: "Reports", icon: BarChart2, to: "reports", description: "KPIs & exports" },
  { label: "Billing & Subscription", icon: CreditCard, to: "billing", description: "Plans, usage, invoices" },
  { label: "Integrations", icon: Globe, to: "integrations", description: "Connect 3rd party apps" },
  { label: "API Keys", icon: KeyRound, to: "api-keys", description: "Programmatic access" },
  { label: "Security Center", icon: ShieldAlert, to: "security", description: "2FA, SSO, policies" },
  { label: "Data & Retention", icon: Database, to: "data", description: "Backups & retention" },
  { label: "Branding & Theme", icon: Paintbrush, to: "branding", description: "Logos, colors, theme" },
];

function AdminLayout() {
  const loc = useLocation();
  const title = loc.pathname.split("/").pop()?.replaceAll("-", " ") || "Admin";

  return (
    <div className="min-h-[calc(100vh-48px)] grid md:grid-cols-[260px_1fr] gap-4 p-4 md:p-6">
      {/* Sidebar */}
      <Card className="h-full sticky top-4 hidden md:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {adminMenu.map(({ label, icon: Icon, to, description }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? "bg-muted text-primary" : "hover:bg-muted"
                }`
              }
              title={description}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </CardContent>
      </Card>

      {/* Main */}
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-wrap items-center gap-3"
        >
          <div>
            <div className="text-2xl font-semibold capitalize">{title}</div>
            <p className="text-sm text-muted-foreground">World‑class admin for a futuristic SaaS ERP.</p>
          </div>
          <div className="flex-1" />
          <SearchBar />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="default" className="rounded-2xl"><Plus className="h-4 w-4 mr-1"/>Quick Create</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[520px] sm:w-[600px]">
              <SheetHeader>
                <SheetTitle>Quick Create</SheetTitle>
              </SheetHeader>
              <QuickCreateForm />
            </SheetContent>
          </Sheet>
        </motion.div>

        <Outlet />
      </div>
    </div>
  );
}

function SearchBar() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search admin…" className="pl-8 w-64" />
      </div>
      <Button variant="secondary">Search</Button>
    </div>
  );
}

function QuickCreateForm() {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>User Name</Label>
          <Input placeholder="Jane Admin" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" placeholder="jane@acme.com" />
        </div>
        <div>
          <Label>Role</Label>
          <Select defaultValue="admin">
            <SelectTrigger><SelectValue placeholder="Select role"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 mt-6">
          <Switch id="active" defaultChecked /><Label htmlFor="active">Active</Label>
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea placeholder="Optional notes…" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button>Save</Button>
      </div>
    </div>
  );
}

// ----------------------------- Reusable Table -----------------------------------
function DataTable({ columns, rows, renderActions }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Results</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Download className="h-4 w-4 mr-1"/>Export</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead className="w-[60px] text-right">…</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{c.render ? c.render(r) : r[c.key]}</TableCell>
                  ))}
                  <TableCell className="text-right">
                    {renderActions ? renderActions(r) : <RowActions />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4"/></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2"/>Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-red-600" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2"/>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ----------------------------- Pages --------------------------------------------
function UsersPage() {
  const rows = [
    { id: "u_1", name: "Jane Admin", email: "jane@acme.com", role: "Admin", status: "Active" },
    { id: "u_2", name: "Ben Manager", email: "ben@acme.com", role: "Manager", status: "Active" },
    { id: "u_3", name: "Vera Viewer", email: "vera@acme.com", role: "Viewer", status: "Suspended" },
  ];
  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "status", label: "Status", render: (r) => (<Badge variant={r.status === "Active" ? "default" : "secondary"}>{r.status}</Badge>) },
  ];
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Invite User" />
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

function RolesPage() {
  const rows = [
    { id: "r_1", name: "Admin", members: 4, policies: 18 },
    { id: "r_2", name: "Manager", members: 12, policies: 9 },
    { id: "r_3", name: "Viewer", members: 32, policies: 4 },
  ];
  const columns = [
    { key: "name", label: "Role" },
    { key: "members", label: "Members" },
    { key: "policies", label: "Policies" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Create Role" />
      <DataTable columns={columns} rows={rows} />
      <Card>
        <CardHeader><CardTitle>Policy Coverage</CardTitle></CardHeader>
        <CardContent style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[{ k: "Auth", v: 10 }, { k: "Records", v: 18 }, { k: "Audit", v: 14 }, { k: "Exports", v: 22 }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="k" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="v" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function CompaniesPage() {
  const rows = [
    { id: "c_1", name: "Acme Inc.", tax: "US-12345", country: "US" },
    { id: "c_2", name: "Globex Ltd.", tax: "UK-88991", country: "UK" },
  ];
  const columns = [
    { key: "name", label: "Company" },
    { key: "tax", label: "Tax ID" },
    { key: "country", label: "Country" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Add Company" />
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

function TenantsPage() {
  const rows = [
    { id: "t_1", code: "acme", status: "Active", region: "us-east-1" },
    { id: "t_2", code: "globex", status: "Active", region: "eu-west-1" },
  ];
  const columns = [
    { key: "code", label: "Tenant Code" },
    { key: "status", label: "Status", render: (r) => (<Badge>{r.status}</Badge>) },
    { key: "region", label: "Region" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Create Tenant" />
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Default Currency</Label>
                <Select defaultValue="usd">
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                    <SelectItem value="inr">INR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch id="beta" defaultChecked /><Label htmlFor="beta">Enable beta features</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="security">
          <SecurityCenterPage compact />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingPage compact />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditPage() {
  const rows = [
    { id: "a_1", ts: "2025-08-01 10:22", actor: "jane", action: "USER_UPDATE", target: "u_2" },
    { id: "a_2", ts: "2025-08-02 14:11", actor: "system", action: "EXPORT_GENERATE", target: "leads.csv" },
  ];
  const columns = [
    { key: "ts", label: "Timestamp" },
    { key: "actor", label: "Actor" },
    { key: "action", label: "Action" },
    { key: "target", label: "Target" },
  ];
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Download Logs" />
      <DataTable columns={columns} rows={rows} />
    </div>
  );
}

function NotificationsPage() {
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Add Channel" />
      <Card>
        <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">Email</div>
              <div className="text-xs text-muted-foreground">Sendgrid / SES</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">SMS</div>
              <div className="text-xs text-muted-foreground">Twilio</div>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">Webhooks</div>
              <div className="text-xs text-muted-foreground">Outbound POST</div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsPage() {
  const data = [
    { m: "Jan", v: 120 },
    { m: "Feb", v: 180 },
    { m: "Mar", v: 160 },
    { m: "Apr", v: 240 },
  ];
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Export" />
      <Card>
        <CardHeader><CardTitle>Usage KPIs</CardTitle></CardHeader>
        <CardContent style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="m" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="v" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingPage() {
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Update Plan" />
      <Card>
        <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="border rounded-xl p-4">
            <div className="text-sm text-muted-foreground">Plan</div>
            <div className="text-lg font-semibold">Pro</div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-sm text-muted-foreground">Seats</div>
            <div className="text-lg font-semibold">25</div>
          </div>
          <div className="border rounded-xl p-4">
            <div className="text-sm text-muted-foreground">Renewal</div>
            <div className="text-lg font-semibold">2026‑04‑01</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Connect" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: "Slack", desc: "Notify channels", status: "Disconnected" },
          { name: "HubSpot", desc: "Sync contacts", status: "Connected" },
          { name: "Stripe", desc: "Billing", status: "Connected" },
        ].map((i) => (
          <Card key={i.name} className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{i.name}</span>
                <Badge variant={i.status === "Connected" ? "default" : "secondary"}>{i.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{i.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ApiKeysPage() {
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Create API Key" />
      <Card>
        <CardHeader><CardTitle>Keys</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No keys yet.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityCenterPage({ compact }) {
  return (
    <div className={`space-y-4 ${compact ? "mt-4" : ""}`}>
      <Card>
        <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">Two‑Factor Authentication</div>
              <div className="text-xs text-muted-foreground">TOTP / SMS / Email</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">SSO (SAML/OIDC)</div>
              <div className="text-xs text-muted-foreground">Okta, Azure AD, Google</div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Policies</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">Password policy</div>
              <div className="text-xs text-muted-foreground">Length, complexity, rotation</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <div className="font-medium">IP allowlist</div>
              <div className="text-xs text-muted-foreground">CIDR ranges</div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataRetentionPage() {
  return (
    <div className="space-y-4">
      <Toolbar primaryActionLabel="Save Policy" />
      <Card>
        <CardHeader><CardTitle>Retention Policy</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Audit logs (days)</Label>
            <Input type="number" defaultValue={365} />
          </div>
          <div>
            <Label>Backups (days)</Label>
            <Input type="number" defaultValue={90} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BrandingPage({ compact }) {
  return (
    <div className={`space-y-4 ${compact ? "mt-4" : ""}`}>
      <Card>
        <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Primary color</Label>
            <Input type="color" defaultValue="#6d28d9" />
          </div>
          <div>
            <Label>Accent color</Label>
            <Input type="color" defaultValue="#10b981" />
          </div>
          <div className="sm:col-span-2">
            <Label>Logo URL</Label>
            <Input placeholder="https://cdn.example.com/logo.png" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------- Page Toolbar -------------------------------------
function Toolbar({ primaryActionLabel }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Filter results…" className="pl-8 w-60" />
      </div>
      <Button variant="secondary">Search</Button>
      <div className="flex-1" />
      <Button><Plus className="h-4 w-4 mr-1"/>{primaryActionLabel}</Button>
      <Button variant="outline"><Download className="h-4 w-4 mr-1"/>Export</Button>
    </div>
  );
}

// ----------------------------- Router Export ------------------------------------
export const adminRoutes = (
  <Route path="admin" element={<AdminLayout />}>
    <Route index element={<UsersPage />} />
    <Route path="users" element={<UsersPage />} />
    <Route path="roles" element={<RolesPage />} />
    <Route path="companies" element={<CompaniesPage />} />
    <Route path="tenants" element={<TenantsPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="audit" element={<AuditPage />} />
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="billing" element={<BillingPage />} />
    <Route path="integrations" element={<IntegrationsPage />} />
    <Route path="api-keys" element={<ApiKeysPage />} />
    <Route path="security" element={<SecurityCenterPage />} />
    <Route path="data" element={<DataRetentionPage />} />
    <Route path="branding" element={<BrandingPage />} />
  </Route>
);

// A tiny preview component so this file can render on its own if you open it directly.
export default function AdminModulePreview() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Module Scaffold</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Routes exported as <code>adminRoutes</code>. Mount under <code>/app</code> in your main router. Pages are production-grade skeletons with tables, charts, and forms ready for API wiring.</p>
        </CardContent>
      </Card>
    </div>
  );
}
