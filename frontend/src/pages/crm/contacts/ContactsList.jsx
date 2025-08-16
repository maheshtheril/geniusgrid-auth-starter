// src/pages/crm/contacts/ContactsList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Toolbar } from "../_shared/Toolbar";
import ContactDrawer from "./ContactDrawer";
import { listContacts, createContact, updateContact } from "./mockApi";

export default function ContactsList(){
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(()=>{ (async()=> setRows(await listContacts()))(); },[]);

  const filtered = useMemo(()=> rows.filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.company.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase())
  ), [rows,q]);

  const save = async (data)=>{
    if (editing) {
      const saved = await updateContact(editing.id, data);
      setRows(prev=> prev.map(r=> r.id===saved.id ? saved : r));
    } else {
      const created = await createContact(data);
      setRows(prev=> [created, ...prev]);
    }
    setOpen(false); setEditing(null);
  };

  return (
    <div>
      <Toolbar title="Contacts" onAdd={()=>{setEditing(null); setOpen(true);}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name/company/email…" className="h-9 px-3 rounded-lg border bg-background" />
      </Toolbar>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40"><tr>
            {['Name','Company','Email','Phone','Title','Status','Actions'].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length===0 && (<tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No contacts</td></tr>)}
            {filtered.map(r=> (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.company}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.email}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.phone}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.title||'-'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.status}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button className="h-8 px-2 rounded-lg border text-xs" onClick={()=>{setEditing(r); setOpen(true);}}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContactDrawer open={open} contact={editing} onClose={()=>{setOpen(false); setEditing(null);}} onSave={save} />
    </div>
  );
}