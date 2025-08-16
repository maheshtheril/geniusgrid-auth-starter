// =============================
// CRM Company Detail UI Pack (UI-only, no new deps)
// Adds nested routes under /app/crm/companies/:companyId
// Files:
//   - companies/mockApi.js (mock data + helpers)
//   - companies/CompanyLayout.jsx (header + tabs + loader)
//   - companies/CompanyOverview.jsx (summary cards)
//   - companies/CompanyPeople.jsx (contacts table + quick add)
//   - companies/CompanyDeals.jsx (deals table)
//   - companies/CompanyActivity.jsx (notes/calls/tasks timeline + add note)
//   - companies/NoteDrawer.jsx (add/edit note)
//   - companies/routes.companies.jsx (route bundle to import into App.jsx)
// Requires: lucide-react, react-router v6, Tailwind; uses existing CompaniesPage for index list
// =============================

// ---------- FILE: src/pages/crm/companies/mockApi.js ----------
export const COMPANIES = [
  { id: "acme", name: "Acme Pvt Ltd", domain: "acme.example", industry: "Software", owner: "Aisha", city: "Mumbai", country: "IN" },
  { id: "abc", name: "ABC Corp", domain: "abc.com", industry: "Retail", owner: "Priya", city: "Bengaluru", country: "IN" },
];

export const COMPANY_CONTACTS = {
  acme: [
    { id: "c101", name: "Rohan S", title: "CTO", email: "rohan@acme.example", phone: "+91 90000 11111" },
    { id: "c102", name: "Meera K", title: "Procurement", email: "meera@acme.example", phone: "+91 98888 22222" },
  ],
  abc: [
    { id: "c201", name: "Priya Sharma", title: "Procurement", email: "priya@abc.com", phone: "+91 98765 43210" },
  ],
};

export const COMPANY_DEALS = {
  acme: [
    { id: "d900", title: "CRM Rollout", amount: 1500000, stage: "qualified", owner: "Aisha" },
    { id: "d901", title: "Support Contract", amount: 200000, stage: "new", owner: "Aisha" },
  ],
  abc: [
    { id: "d500", title: "Website Revamp", amount: 450000, stage: "proposal", owner: "Priya" },
  ],
};

export const COMPANY_ACTIVITY = {
  acme: [
    { id: "a1", ts: "2025-08-15 12:00", kind: "note", text: "Intro call went well. Send deck.", by: "Aisha" },
    { id: "a2", ts: "2025-08-16 09:30", kind: "call", text: "Scheduled demo for Monday", by: "Aisha" },
    { id: "a3", ts: "2025-08-16 10:15", kind: "task", text: "Prepare SOW draft", by: "Aisha" },
  ],
  abc: [
    { id: "b1", ts: "2025-08-14 18:22", kind: "deal", text: "Deal moved to Proposal", by: "Priya" },
  ],
};

export async function getCompany(id) {
  return COMPANIES.find((c) => c.id === id) || null;
}
export async function listCompanyContacts(id) {
  return (COMPANY_CONTACTS[id] || []).slice();
}
export async function listCompanyDeals(id) {
  return (COMPANY_DEALS[id] || []).slice();
}
export async function listCompanyActivity(id) {
  return (COMPANY_ACTIVITY[id] || []).slice().sort((a,b)=> (a.ts>b.ts? -1:1));
}
export async function addCompanyNote(id, payload) {
  const note = { id: Math.random().toString(36).slice(2,8), ts: new Date().toISOString().slice(0,16).replace('T',' '), kind: 'note', by: payload.by || 'You', text: payload.text || '' };
  COMPANY_ACTIVITY[id] = [note, ...(COMPANY_ACTIVITY[id]||[])];
  return note;
}













// ---------- HOW TO WIRE (App.jsx) ----------
// 1) Import the route bundle:
// import { crmCompanyRoutes } from "@/pages/crm/companies/routes.companies";
// 2) Inside your existing /app/* -> crm group, add {crmCompanyRoutes} as a sibling to deals, incentives, crmExtraRoutes.
// Example:
// <Route path="/app/*" element={<ProtectedShell />}>
//   <Route path="crm" element={<CrmOutlet />}>
//     {/* ...existing crm routes... */}
//     {crmCompanyRoutes}
//   </Route>
// </Route>
