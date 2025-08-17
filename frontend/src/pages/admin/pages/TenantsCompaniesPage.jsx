// ---------- FILE: src/pages/admin/pages/TenantsCompaniesPage.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";
import DrawerForm from "@/pages/admin/_shared/DrawerForm";
import { fetcher, poster, patcher } from "@/pages/admin/_shared/fetcher";

const MOCK = [
  { id: "t1", type: "Tenant", name: "Demo Tenant", domain: "demo", plan: "Free", companies: 1, status: "Active" },
  { id: "c1", type: "Company", name: "Genius Infravision", domain: "genius", tenant: "Demo Tenant", industry: "Software", status: "Active" },
];

export default function TenantsCompaniesPage(){
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type:"Tenant", name:"", domain:"", plan:"Free", status:"Active" });

  useEffect(() => {
    (async () => {
      const data = await fetcher("/api/admin/tenants-companies", { fallback: MOCK });
      setRows(Array.isArray(data)? data : MOCK);
    })();
  }, []);

  function openCreate(){ setEditing(null); setForm({ type:"Tenant", name:"", domain:"", plan:"Free", status:"Active" }); setDrawerOpen(true); }
  function openEdit(r){ setEditing(r); setForm(r); setDrawerOpen(true); }

  async function save(){
    const body = { ...form };
    try {
      if (editing) {
        await patcher(`/api/admin/tenants-companies/${editing.id}`, body);
        setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      } else {
        const created = await poster(`/api/admin/tenants-companies`, body);
        setRows(rs => [{ ...body, id: created?.id || `x_${Date.now()}` }, ...rs]);
      }
    } catch {
      if (editing) setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      else setRows(rs => [{ ...body, id: `x_${Date.now()}` }, ...rs]);
    }
    setDrawerOpen(false);
  }

  const columns = useMemo(() => ([
    { key: "type",     header: "Type" },
    { key: "name",     header: "Name" },
    { key: "domain",   header: "Domain" },
    { key: "tenant",   header: "Tenant" },
    { key: "plan",     header: "Plan" },
    { key: "industry", header: "Industry" },
    { key: "companies",header: "Companies" },
    { key: "status",   header: "Status" },
  ]), []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Building2 size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Tenants & Companies</h1>
        <div className="flex-1" />
        <button className="gg-btn" onClick={openCreate}><Plus size={16} /> New</button>
      </div>
      <DataTable columns={columns} rows={rows} onRowClick={openEdit} />

      <DrawerForm
        title={editing ? "Edit" : "Create"}
        open={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        footer={(
          <>
            <button className="gg-btn" onClick={()=>setDrawerOpen(false)}>Cancel</button>
            <button className="gg-btn-primary" onClick={save}>Save</button>
          </>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Type</span>
            <select className="gg-input h-10 px-3 rounded-md" value={form.type} onChange={e=>setForm(s=>({...s,type:e.target.value}))}>
              <option>Tenant</option>
              <option>Company</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Name</span>
            <input className="gg-input h-10 px-3 rounded-md" value={form.name||""} onChange={e=>setForm(s=>({...s,name:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Domain</span>
            <input className="gg-input h-10 px-3 rounded-md" value={form.domain||""} onChange={e=>setForm(s=>({...s,domain:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Plan</span>
            <select className="gg-input h-10 px-3 rounded-md" value={form.plan||"Free"} onChange={e=>setForm(s=>({...s,plan:e.target.value}))}>
              {['Free','Pro','Enterprise'].map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs opacity-70">Status</span>
            <select className="gg-input h-10 px-3 rounded-md" value={form.status||"Active"} onChange={e=>setForm(s=>({...s,status:e.target.value}))}>
              {['Active','Suspended','Disabled'].map(p=> <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
      </DrawerForm>
    </section>
  );
}

