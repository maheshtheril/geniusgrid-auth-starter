// ---------- FILE: src/pages/admin/pages/UsersPage.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { Shield, UserPlus } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";
import DrawerForm from "@/pages/admin/_shared/DrawerForm";
import { fetcher, poster, patcher } from "@/pages/admin/_shared/fetcher";

const MOCK_USERS = [
  { id: "u1", name: "Admin User", email: "admin@geniusgrid.app", role: "Administrator", company: "Genius Infravision", tenant: "Demo", status: "Active" },
  { id: "u2", name: "Sales Lead", email: "sales@geniusgrid.app", role: "Sales Manager", company: "Genius Infravision", tenant: "Demo", status: "Active" },
  { id: "u3", name: "Ops", email: "ops@geniusgrid.app", role: "Operator", company: "Genius Infravision", tenant: "Demo", status: "Suspended" },
];

export default function UsersPage(){
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", email:"", role:"", company:"", tenant:"", status:"Active" });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await fetcher("/api/admin/users", { fallback: MOCK_USERS });
      if(mounted) setRows(Array.isArray(data)? data : MOCK_USERS);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  function openCreate(){ setEditing(null); setForm({ name:"", email:"", role:"", company:"", tenant:"", status:"Active" }); setDrawerOpen(true); }
  function openEdit(r){ setEditing(r); setForm(r); setDrawerOpen(true); }

  async function save(){
    const body = { ...form };
    try {
      if (editing) {
        await patcher(`/api/admin/users/${editing.id}`, body);
        setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      } else {
        const created = await poster(`/api/admin/users`, body);
        setRows(rs => [{ ...body, id: created?.id || `u_${Date.now()}` }, ...rs]);
      }
    } catch {
      // fallback: optimistic local only
      if (editing) setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      else setRows(rs => [{ ...body, id: `u_${Date.now()}` }, ...rs]);
    }
    setDrawerOpen(false);
  }

  const columns = useMemo(() => ([
    { key: "name",    header: "Name" },
    { key: "email",   header: "Email" },
    { key: "role",    header: "Role" },
    { key: "company", header: "Company" },
    { key: "tenant",  header: "Tenant" },
    { key: "status",  header: "Status" },
  ]), []);

  return (
    <section className="w-full">
      <div className="flex items-center gap-3 mb-4">
        <Shield size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex-1" />
        <button className="gg-btn" onClick={openCreate}><UserPlus size={16} /> Add</button>
      </div>

      <DataTable columns={columns} rows={rows} onRowClick={openEdit} />

      <DrawerForm
        title={editing ? "Edit User" : "Add User"}
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
          {[
            { k:"name",    label:"Name",    type:"text" },
            { k:"email",   label:"Email",   type:"email" },
            { k:"role",    label:"Role",    type:"text" },
            { k:"company", label:"Company", type:"text" },
            { k:"tenant",  label:"Tenant",  type:"text" },
          ].map(f => (
            <label key={f.k} className="flex flex-col gap-1">
              <span className="text-xs opacity-70">{f.label}</span>
              <input className="gg-input h-10 px-3 rounded-md" type={f.type} value={form[f.k]||""} onChange={e=>setForm(s=>({...s,[f.k]:e.target.value}))} />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Status</span>
            <select className="gg-input h-10 px-3 rounded-md" value={form.status} onChange={e=>setForm(s=>({...s,status:e.target.value}))}>
              {['Active','Suspended','Invited'].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
      </DrawerForm>
    </section>
  );
}

