// src/breadcrumbs/registry.js
// Central place to define breadcrumb behavior per route/pattern

// --- helpers: detect ids (uuid, numeric)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUM_RE = /^[0-9]+$/;

export const isIdLike = (s) => UUID_RE.test(s) || NUM_RE.test(s);

// --- API name resolvers (replace with your real endpoints)
async function fetchLeadName(id) {
  // GET /api/leads/:id -> { name: "..."} (adjust to your shape)
  const res = await fetch(`/api/leads/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.name || data?.title || `Lead ${id}`;
}
async function fetchCompanyName(id) {
  const res = await fetch(`/api/companies/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.name || `Company ${id}`;
}
async function fetchContactName(id) {
  const res = await fetch(`/api/contacts/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.full_name || data?.name || `Contact ${id}`;
}
async function fetchDealName(id) {
  const res = await fetch(`/api/deals/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.title || data?.name || `Deal ${id}`;
}

// --- static labels for top-level modules
const STATIC = {
  "": { label: "Dashboard", href: "/dashboard" },
  dashboard: { label: "Dashboard", href: "/dashboard" },
  admin: { label: "Admin", href: "/admin" },
  crm: { label: "CRM", href: "/crm" },
  leads: { label: "Leads", href: "/crm/leads" },
  companies: { label: "Companies", href: "/crm/companies" },
  contacts: { label: "Contacts", href: "/crm/contacts" },
  deals: { label: "Deals", href: "/crm/deals" },
  settings: { label: "Settings", href: "/admin/settings" },
  users: { label: "Users", href: "/admin/users" },
  roles: { label: "Roles & Permissions", href: "/admin/roles" },
  menus: { label: "Menus", href: "/admin/menus" },
  reports: { label: "Reports", href: "/reports" },
};

// --- dynamic entity resolvers keyed by parent segment
const ENTITY_RESOLVERS = {
  leads: fetchLeadName,
  companies: fetchCompanyName,
  contacts: fetchContactName,
  deals: fetchDealName,
};

// Export API
export function lookupStatic(seg) {
  return STATIC[seg];
}
export function resolverFor(parentSeg) {
  return ENTITY_RESOLVERS[parentSeg];
}
