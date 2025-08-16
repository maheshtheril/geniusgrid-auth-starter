// src/pages/crm/tasks/TasksList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Toolbar } from "../_shared/Toolbar";
import TaskDrawer from "./TaskDrawer";
import { listTasks, createTask, updateTask } from "./mockApi";

export default function TasksList(){
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(()=>{ (async()=> setRows(await listTasks()))(); },[]);

  const filtered = useMemo(()=> rows.filter(r =>
    (!q || r.title.toLowerCase().includes(q.toLowerCase())) && (!status || r.status===status)
  ), [rows,q,status]);

  const save = async (data)=>{
    if (editing) { const saved = await updateTask(editing.id, data); setRows(prev=> prev.map(r=> r.id===saved.id ? saved : r)); }
    else { const created = await createTask(data); setRows(prev=> [created, ...prev]); }
    setOpen(false); setEditing(null);
  };

  const pill = (s)=> {
    const map = { done:"bg-green-500/20 text-green-300", "in-progress":"bg-amber-500/20 text-amber-300", todo:"bg-white/10" };
    return <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${map[s]||"bg-white/10"}`}>{s}</span>;
  };

  return (
    <div>
      <Toolbar title="Tasks" onAdd={()=>{setEditing(null); setOpen(true);}}>
        <div className="flex items-center gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search tasks…" className="h-9 px-3 rounded-lg border bg-background" />
          <select value={status} onChange={e=>setStatus(e.target.value)} className="h-9 px-3 rounded-lg border bg-background">
            <option value="">All</option>
            <option value="todo">To-do</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </Toolbar>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40"><tr>
            {['Title','Owner','Due','Status','Related','Actions'].map(h=> <th key={h} className="px-3 py-2 font-medium text-left">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.length===0 && (<tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No tasks</td></tr>)}
            {filtered.map(r=> (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.title}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.owner}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.due}</td>
                <td className="px-3 py-2 whitespace-nowrap">{pill(r.status)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.related||'-'}</td>
                <td className="px-3 py-2 whitespace-nowrap"><button className="h-8 px-2 rounded-lg border text-xs" onClick={()=>{setEditing(r); setOpen(true);}}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TaskDrawer open={open} task={editing} onClose={()=>{setOpen(false); setEditing(null);}} onSave={save} />
    </div>
  );
}