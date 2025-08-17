// ---------- FILE: src/pages/admin/pages/RolesPage.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";
import DrawerForm from "@/pages/admin/_shared/DrawerForm";
import { fetcher, poster, patcher } from "@/pages/admin/_shared/fetcher";

const MOCK_ROLES = [
  { id: "r1", name: "Administrator", description: "Full access", permissions: ["users.read","users.write","menus.manage"] },
  { id: "r2", name: "Sales Manager", description: "Leads & deals", permissions: ["leads.read","deals.write"] },
  { id: "r3", name: "Viewer", description: "Read-only", permissions: ["*.*.read"] },
];

export default function RolesPage(){
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", description:"", permissions: [] });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await fetcher("/api/admin/roles", { fallback: MOCK_ROLES });
      if(mounted) setRows(Array.isArray(data)? data : MOCK_ROLES);
    })();
    return () => { mounted = false; };
  }, []);

  function openCreate(){ setEditing(null); setForm({ name:"", description:"", permissions: [] }); setDrawerOpen(true); }
  function openEdit(r){ setEditing(r); setForm({ ...r, permissions: r.permissions || [] }); setDrawerOpen(true); }

  async function save(){
    const body = { ...form };
    try {
      if (editing) {
        await patcher(`/api/admin/roles/${editing.id}`, body);
        setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      } else {
        const created = await poster(`/api/admin/roles`, body);
        setRows(rs => [{ ...body, id: created?.id || `r_${Date.now()}` }, ...rs]);
      }
    } catch {
      if (editing) setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      else setRows(rs => [{ ...body, id: `r_${Date.now()}` }, ...rs]);
    }
    setDrawerOpen(false);
  }

  const columns = useMemo(() => ([
    { key: "name",        header: "Role" },
    { key: "description", header: "Description" },
    { key: "permissions", header: "Permissions", render: (v)=> Array.isArray(v)? v.join(", ") : "—" },
  ]), []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <KeyRound size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Roles & Permissions</h1>
        <div className="flex-1" />
        <button className="gg-btn" onClick={openCreate}><Plus size={16} /> New Role</button>
      </div>

      <DataTable columns={columns} rows={rows} onRowClick={openEdit} />

      <DrawerForm
        title={editing ? "Edit Role" : "New Role"}
        open={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        footer={(
          <>
            <button className="gg-btn" onClick={()=>setDrawerOpen(false)}>Cancel</button>
            <button className="gg-btn-primary" onClick={save}>Save</button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Role name</span>
            <input className="gg-input h-10 px-3 rounded-md" value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Description</span>
            <input className="gg-input h-10 px-3 rounded-md" value={form.description} onChange={e=>setForm(s=>({...s,description:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Permissions (comma-separated)</span>
            <input className="gg-input h-10 px-3 rounded-md" value={(form.permissions||[]).join(", ")} onChange={e=>setForm(s=>({...s,permissions:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)}))} />
          </label>
        </div>
      </DrawerForm>
    </section>
  );
}

