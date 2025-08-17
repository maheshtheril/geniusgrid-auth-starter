// ---------- FILE: src/pages/admin/pages/MenusPage.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { ListTree, Plus } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";
import DrawerForm from "@/pages/admin/_shared/DrawerForm";
import { fetcher, poster, patcher } from "@/pages/admin/_shared/fetcher";

const MOCK = [
  { id:"m1", name:"CRM", path:"/app/crm", icon:"PanelsLeft", parent:null, sort:1, permission:"crm.view" },
  { id:"m2", name:"Leads", path:"/app/crm/leads", icon:"Users", parent:"CRM", sort:2, permission:"leads.view" },
];

export default function MenusPage(){
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", path:"", icon:"", parent:null, sort:0, permission:"" });

  useEffect(()=>{ (async()=>{
    const data = await fetcher("/api/admin/menus", { fallback: MOCK });
    setRows(Array.isArray(data)? data : MOCK);
  })(); }, []);

  function openCreate(){ setEditing(null); setForm({ name:"", path:"", icon:"", parent:null, sort:0, permission:"" }); setDrawerOpen(true); }
  function openEdit(r){ setEditing(r); setForm(r); setDrawerOpen(true); }

  async function save(){
    const body = { ...form };
    try {
      if (editing) {
        await patcher(`/api/admin/menus/${editing.id}`, body);
        setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      } else {
        const created = await poster(`/api/admin/menus`, body);
        setRows(rs => [{ ...body, id: created?.id || `m_${Date.now()}` }, ...rs]);
      }
    } catch {
      if (editing) setRows(rs => rs.map(r => r.id === editing.id ? { ...r, ...body } : r));
      else setRows(rs => [{ ...body, id: `m_${Date.now()}` }, ...rs]);
    }
    setDrawerOpen(false);
  }

  const columns = useMemo(() => ([
    { key: "name", header: "Name" },
    { key: "path", header: "Path" },
    { key: "icon", header: "Icon" },
    { key: "parent", header: "Parent" },
    { key: "sort", header: "Sort" },
    { key: "permission", header: "Permission" },
  ]), []);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <ListTree size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Menus</h1>
        <div className="flex-1" />
        <button className="gg-btn" onClick={openCreate}><Plus size={16} /> New</button>
      </div>
      <DataTable columns={columns} rows={rows} onRowClick={openEdit} />

      <DrawerForm title={editing?"Edit Menu":"New Menu"} open={drawerOpen} onClose={()=>setDrawerOpen(false)} footer={(
        <>
          <button className="gg-btn" onClick={()=>setDrawerOpen(false)}>Cancel</button>
          <button className="gg-btn-primary" onClick={save}>Save</button>
        </>
      )}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {k:"name",label:"Name"},
            {k:"path",label:"Path"},
            {k:"icon",label:"Icon"},
            {k:"parent",label:"Parent"},
            {k:"permission",label:"Permission"},
          ].map(f => (
            <label key={f.k} className="flex flex-col gap-1">
              <span className="text-xs opacity-70">{f.label}</span>
              <input className="gg-input h-10 px-3 rounded-md" value={form[f.k]||""} onChange={e=>setForm(s=>({...s,[f.k]:e.target.value}))} />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Sort</span>
            <input type="number" className="gg-input h-10 px-3 rounded-md" value={form.sort||0} onChange={e=>setForm(s=>({...s,sort:Number(e.target.value||0)}))} />
          </label>
        </div>
      </DrawerForm>
    </section>
  );
}

