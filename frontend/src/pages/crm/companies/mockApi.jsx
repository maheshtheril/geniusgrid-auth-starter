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

// ---------- FILE: src/pages/crm/companies/CompanyLayout.jsx ----------
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft } from "lucide-react";
import { getCompany } from "./mockApi";

const TABS = [
  { to: "overview", label: "Overview" },
  { to: "people", label: "People" },
  { to: "deals", label: "Deals" },
  { to: "activity", label: "Activity" },
];

export default function CompanyLayout(){
  const { companyId } = useParams();
  const nav = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ (async()=>{ setLoading(true); setCompany(await getCompany(companyId)); setLoading(false); })(); },[companyId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!company) return (
    <div className="p-6 space-y-3">
      <button className="text-sm underline" onClick={()=> nav(-1)}><ArrowLeft className="inline h-4 w-4"/> Back</button>
      <div className="text-lg">Company not found.</div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center"><Building2 className="h-5 w-5"/></div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.industry} • Owner: {company.owner} • {company.city}, {company.country}</p>
        </div>
        <div className="flex-1" />
        <button className="h-9 px-3 rounded-lg border text-sm" onClick={()=> nav("/app/crm/companies")}>All Companies</button>
      </div>

      {/* Tabs */}
      <div className="w-full overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-muted">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({isActive}) => `px-4 h-9 inline-flex items-center rounded-lg whitespace-nowrap text-sm transition ${isActive ? 'bg-background shadow border' : 'hover:bg-background/60'}`}
            >{t.label}</NavLink>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet context={{ company }} />
      </div>
    </div>
  );
}

// ---------- FILE: src/pages/crm/companies/CompanyOverview.jsx ----------
import React from "react";
import { useOutletContext } from "react-router-dom";

const Card = ({ title, value, sub }) => (
  <div className="p-4 rounded-xl border bg-background">
    <div className="text-xs text-muted-foreground">{title}</div>
    <div className="text-2xl font-semibold">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

export default function CompanyOverview(){
  const { company } = useOutletContext();
  // demo numbers
  const stats = { deals: 3, revenue: 2100000, lastActivity: "2025-08-16 10:15" };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card title="Open Deals" value={stats.deals} />
        <Card title="Revenue to date" value={`₹${stats.revenue.toLocaleString('en-IN')}`} />
        <Card title="Last activity" value={stats.lastActivity} />
      </div>
      <div className="p-4 rounded-xl border bg-background">
        <div className="font-medium mb-2">Company Info</div>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Domain:</span> {company.domain || '-'}</div>
          <div><span className="text-muted-foreground">Industry:</span> {company.industry || '-'}</div>
          <div><span className="text-muted-foreground">Owner:</span> {company.owner || '-'}</div>
          <div><span className="text-muted-foreground">Location:</span> {company.city}, {company.country}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- FILE: src/pages/crm/companies/CompanyPeople.jsx ----------
import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listCompanyContacts } from "./mockApi";

export default function CompanyPeople(){
  const { company } = useOutletContext();
  const [rows, setRows] = useState([]);
  useEffect(()=> { (async()=> setRows(await listCompanyContacts(company.id)))(); }, [company.id]);

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40"><tr>
          {["Name","Title","Email","Phone"].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.length===0 && <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>No contacts</td></tr>}
          {rows.map(r=> (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.title||'-'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.email}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- FILE: src/pages/crm/companies/CompanyDeals.jsx ----------
import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listCompanyDeals } from "./mockApi";

export default function CompanyDeals(){
  const { company } = useOutletContext();
  const [rows, setRows] = useState([]);
  useEffect(()=> { (async()=> setRows(await listCompanyDeals(company.id)))(); }, [company.id]);

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40"><tr>
          {["Title","Owner","Stage","Amount"].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.length===0 && <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>No deals</td></tr>}
          {rows.map(r=> (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 whitespace-nowrap">{r.title}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.owner}</td>
              <td className="px-3 py-2 whitespace-nowrap capitalize">{r.stage}</td>
              <td className="px-3 py-2 whitespace-nowrap">₹{r.amount.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- FILE: src/pages/crm/companies/NoteDrawer.jsx ----------
import React, { useEffect, useState } from "react";
import { Modal } from "../_shared/Modal";

export default function NoteDrawer({ open, onClose, note, onSave }){
  const [form, setForm] = useState(note || {});
  useEffect(()=> setForm(note || {}), [note]);
  return (
    <Modal open={open} title="Add Note" onClose={onClose} onSubmit={()=> onSave?.(form)} submitLabel="Save">
      <div className="grid gap-2">
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Note</span>
          <textarea className="min-h-[120px] rounded-lg border bg-background px-3 py-2" value={form.text||''} onChange={e=> setForm(p=>({...p, text: e.target.value}))} />
        </label>
      </div>
    </Modal>
  );
}

// ---------- FILE: src/pages/crm/companies/CompanyActivity.jsx ----------
import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listCompanyActivity, addCompanyNote } from "./mockApi";
import NoteDrawer from "./NoteDrawer";

function Item({ it }){
  const chip = {
    note: "bg-white/10",
    call: "bg-amber-500/20 text-amber-300",
    task: "bg-blue-500/20 text-blue-300",
    deal: "bg-purple-500/20 text-purple-300",
  }[it.kind] || "bg-white/10";
  return (
    <div className="p-3 rounded-xl border bg-background">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`px-2 py-0.5 rounded-full ${chip}`}>{it.kind}</span>
        <span>{it.ts}</span>
        <span>•</span>
        <span>by {it.by}</span>
      </div>
      <div className="text-sm mt-1 whitespace-pre-wrap">{it.text}</div>
    </div>
  );
}

export default function CompanyActivity(){
  const { company } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(()=> { (async()=> setRows(await listCompanyActivity(company.id)))(); }, [company.id]);

  const save = async (data)=> {
    const saved = await addCompanyNote(company.id, { text: data.text, by: 'You' });
    setRows(prev => [saved, ...prev]);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Activity Timeline</div>
        <button className="h-9 px-3 rounded-lg border text-sm" onClick={()=> setOpen(true)}>Add Note</button>
      </div>
      {rows.length===0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
      {rows.map(it => <Item key={it.id} it={it} />)}
      <NoteDrawer open={open} onClose={()=> setOpen(false)} onSave={save} />
    </div>
  );
}

// ---------- FILE: src/pages/crm/companies/IndexRedirect.jsx ----------
import React from "react";
import { Navigate } from "react-router-dom";
export default function CompanyIndexRedirect(){ return <Navigate to="overview" replace />; }

// ---------- FILE: src/pages/crm/companies/routes.companies.jsx ----------
import React from "react";
import { Route } from "react-router-dom";
import CompaniesPage from "@/pages/CompaniesPage"; // your existing list page
import CompanyLayout from "./CompanyLayout";
import CompanyIndexRedirect from "./IndexRedirect";
import CompanyOverview from "./CompanyOverview";
import CompanyPeople from "./CompanyPeople";
import CompanyDeals from "./CompanyDeals";
import CompanyActivity from "./CompanyActivity";

export const crmCompanyRoutes = (
  <>
    {/* Companies list under CRM */}
    <Route path="companies" element={<CompaniesPage />} />

    {/* Company detail */}
    <Route path="companies/:companyId" element={<CompanyLayout />}>
      <Route index element={<CompanyIndexRedirect />} />
      <Route path="overview" element={<CompanyOverview />} />
      <Route path="people" element={<CompanyPeople />} />
      <Route path="deals" element={<CompanyDeals />} />
      <Route path="activity" element={<CompanyActivity />} />
    </Route>
  </>
);

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
