// ---------- FILE: src/pages/admin/pages/UsersPage.jsx ----------
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shield, UserPlus, RotateCcw, Lock, Unlock, Mail, Search, Filter, Users, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable from "@/pages/admin/_shared/DataTable";
import DrawerForm from "@/pages/admin/_shared/DrawerForm";
import { fetcher, poster, patcher, deleter } from "@/pages/admin/_shared/fetcher";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function UsersPage() {
  // table state
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState({ by: "created_at", dir: "desc" });

  // filters
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState(""); // Active/Suspended/Invited
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);

  // selection
  const [selected, setSelected] = useState(new Set());

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name:"", email:"", phone:"", status:"Active",
    role_ids: [], company_ids: [], default_company_id: ""
  });

  // activity side
  const [sideOpen, setSideOpen] = useState(false);
  const [activity, setActivity] = useState([]);

  const loadOptions = async () => {
    const [rs, cs] = await Promise.all([
      fetcher("/api/admin/roles?onlyActive=1").catch(()=>[]),
      fetcher("/api/admin/companies?onlyActive=1").catch(()=>[])
    ]);
    setRoles(rs);
    setCompanies(cs);
  };

  const load = async () => {
    const params = {
      page, page_size: pageSize,
      sort_by: sort.by, sort_dir: sort.dir,
      q: q || undefined,
      role_id: roleId || undefined,
      company_id: companyId || undefined,
      status: status || undefined,
    };
    const r = await fetcher("/api/admin/users", { params, fallback: { items: [], total: 0 } });
    const items = Array.isArray(r?.items) ? r.items : [];
    setRows(items);
    setTotal(Number(r?.total || 0));
    setSelected(new Set()); // clear selection on new page
  };

  useEffect(() => { loadOptions(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize, sort.by, sort.dir, roleId, companyId, status]);

  // debounced search
  const searchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(); }, 250);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line
  }, [q]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name:"", email:"", phone:"", status:"Active", role_ids: [], company_ids: [], default_company_id: "" });
    setDrawerOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      id: r.id,
      name: r.name || "",
      email: r.email || "",
      phone: r.phone || "",
      status: r.is_active ? "Active" : (r.is_locked ? "Suspended" : "Inactive"),
      role_ids: r.role_ids || [],
      company_ids: r.company_ids || [],
      default_company_id: r.default_company_id || r.company_id || "",
    });
    setDrawerOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name?.trim(),
      email: form.email?.trim().toLowerCase(),
      phone: form.phone?.trim() || null,
      is_active: form.status === "Active",
      is_locked: form.status === "Suspended",
      role_ids: form.role_ids,
      company_ids: form.company_ids,
      default_company_id: form.default_company_id || null,
    };
    if (editing?.id) {
      await patcher(`/api/admin/users/${editing.id}`, payload).catch(()=>{});
    } else {
      await poster(`/api/admin/users`, payload).catch(()=>{});
    }
    setDrawerOpen(false);
    load();
  };

  const invite = async (userId) => {
    await poster(`/api/admin/users/${userId}/invite`, {}).catch(()=>{});
    load();
  };

  const resetPassword = async (userId) => {
    await poster(`/api/admin/users/${userId}/reset-password`, {}).catch(()=>{});
  };

  const bulkUpdate = async (patch) => {
    if (!selected.size) return;
    await poster(`/api/admin/users/bulk`, { ids: [...selected], patch }).catch(()=>{});
    load();
  };

  const columns = useMemo(() => ([
    { key: "select", header: "", width: 32,
      cell: (r) => (
        <input type="checkbox"
          checked={selected.has(r.id)}
          onChange={(e)=> {
            const next = new Set(selected);
            e.target.checked ? next.add(r.id) : next.delete(r.id);
            setSelected(next);
          }} />
      )
    },
    { key: "name", header: "Name", sortable: true,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs opacity-70">{r.email}</div>
        </div>
      )
    },
    { key: "roles", header: "Roles",
      cell: (r) => <div className="text-xs">{(r.roles || []).join(", ") || "—"}</div>
    },
    { key: "companies", header: "Companies",
      cell: (r) => <div className="text-xs">{(r.companies || []).join(", ") || "—"}</div>
    },
    { key: "status", header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-1 text-xs">
          {r.is_active ? <span className="px-2 py-0.5 rounded bg-emerald-600/15 text-emerald-400">Active</span>
           : r.is_locked ? <span className="px-2 py-0.5 rounded bg-amber-600/15 text-amber-400">Suspended</span>
           : <span className="px-2 py-0.5 rounded bg-slate-600/15 text-slate-400">Inactive</span>}
          {r.locked_until && <span className="opacity-70">(locks till {new Date(r.locked_until).toLocaleString()})</span>}
        </div>
      )
    },
    { key: "last_active", header: "Last Active", sortable: true,
      cell: (r) => r.last_active ? new Date(r.last_active).toLocaleString() : "—"
    },
    { key: "actions", header: "", width: 210,
      cell: (r) => (
        <div className="flex gap-2 justify-end">
          <button className="gg-btn" title="Invite / Re-invite" onClick={()=>invite(r.id)}><Mail size={14}/></button>
          <button className="gg-btn" title="Reset password" onClick={()=>resetPassword(r.id)}><RotateCcw size={14}/></button>
          {r.is_locked
            ? <button className="gg-btn" title="Unlock" onClick={()=>bulkUpdate({ is_locked:false })}><Unlock size={14}/></button>
            : <button className="gg-btn" title="Suspend" onClick={()=>poster(`/api/admin/users/${r.id}`, { is_locked:true }).then(load)}><Lock size={14}/></button>
          }
          <button className="gg-btn" onClick={()=>{ setSideOpen(true); loadActivity(r.id); }}>Details</button>
        </div>
      )
    },
  ]), [selected]);

  async function loadActivity(userId) {
    const a = await fetcher(`/api/admin/users/${userId}/activity`).catch(()=>[]);
    setActivity(Array.isArray(a)? a : []);
  }

  return (
    <section className="w-full">
      <div className="flex items-center gap-3 mb-3">
        <Shield size={18} className="opacity-70" />
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex-1" />
        <button className="gg-btn" onClick={openCreate}><UserPlus size={16} /> Add</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
          <input className="gg-input pl-8 h-9 w-72" placeholder="Search name/email/phone…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="opacity-70" />
          <select className="gg-input h-9" value={roleId} onChange={e=>{ setRoleId(e.target.value); setPage(1); }}>
            <option value="">All roles</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="gg-input h-9" value={companyId} onChange={e=>{ setCompanyId(e.target.value); setPage(1); }}>
            <option value="">All companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="gg-input h-9" value={status} onChange={e=>{ setStatus(e.target.value); setPage(1); }}>
            <option value="">All status</option>
            <option>Active</option>
            <option>Suspended</option>
            <option>Invited</option>
          </select>
          <select className="gg-input h-9" value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
        <div className="flex-1" />
        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">{selected.size} selected</span>
          <button className="gg-btn" onClick={()=>bulkUpdate({ is_active:true, is_locked:false })}><Unlock size={14}/> Activate</button>
          <button className="gg-btn" onClick={()=>bulkUpdate({ is_locked:true })}><Lock size={14}/> Suspend</button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={openEdit}
        sortable
        sort={sort}
        onSort={setSort}
      />

      {/* pagination */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="text-xs opacity-70">Total {total.toLocaleString()}</span>
        <button className="gg-btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={14}/></button>
        <span className="text-xs">Page {page}</span>
        <button className="gg-btn" disabled={page*pageSize>=total} onClick={()=>setPage(p=>p+1)}><ChevronRight size={14}/></button>
      </div>

      {/* Create/Edit drawer */}
      <DrawerForm
        title={editing ? "Edit User" : "Add User"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={(
          <>
            <button className="gg-btn" onClick={()=>setDrawerOpen(false)}>Cancel</button>
            <button className="gg-btn-primary" onClick={save}>Save</button>
          </>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Name</span>
            <input className="gg-input h-10 px-3 rounded-md" value={form.name} onChange={e=>setForm(s=>({...s, name:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Email</span>
            <input className="gg-input h-10 px-3 rounded-md" type="email" value={form.email} onChange={e=>setForm(s=>({...s, email:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Phone</span>
            <input className="gg-input h-10 px-3 rounded-md" value={form.phone||""} onChange={e=>setForm(s=>({...s, phone:e.target.value}))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Status</span>
            <select className="gg-input h-10 px-3 rounded-md" value={form.status} onChange={e=>setForm(s=>({...s, status:e.target.value}))}>
              {["Active","Suspended","Inactive"].map(v=> <option key={v} value={v}>{v}</option>)}
            </select>
          </label>

          {/* Roles */}
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs opacity-70">Roles</span>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <label key={r.id} className="px-2 py-1 border border-white/10 rounded-md flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.role_ids.includes(r.id)}
                    onChange={(e)=> setForm(s=>{
                      const has = s.role_ids.includes(r.id);
                      return { ...s, role_ids: has ? s.role_ids.filter(x=>x!==r.id) : [...s.role_ids, r.id] };
                    })} />
                  <span className="text-sm">{r.name}</span>
                </label>
              ))}
            </div>
          </label>

          {/* Companies */}
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs opacity-70">Companies</span>
            <div className="flex flex-wrap gap-2">
              {companies.map(c => (
                <label key={c.id} className="px-2 py-1 border border-white/10 rounded-md flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.company_ids.includes(c.id)}
                    onChange={(e)=> setForm(s=>{
                      const has = s.company_ids.includes(c.id);
                      const next = has ? s.company_ids.filter(x=>x!==c.id) : [...s.company_ids, c.id];
                      const def = next.includes(s.default_company_id) ? s.default_company_id : (next[0] || "");
                      return { ...s, company_ids: next, default_company_id: def };
                    })} />
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs opacity-70">Default company</span>
            <select className="gg-input h-10 px-3 rounded-md" value={form.default_company_id}
              onChange={e=>setForm(s=>({...s, default_company_id:e.target.value}))}>
              <option value="">—</option>
              {companies.filter(c => form.company_ids.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </DrawerForm>

      {/* Right side panel — Activity */}
      {sideOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#0b0f14] border-l border-white/10 p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} /><h3 className="font-semibold">User details</h3>
            <div className="flex-1" />
            <button className="gg-btn" onClick={()=>setSideOpen(false)}>Close</button>
          </div>
          <ul className="space-y-2">
            {activity.map((a,i)=>(
              <li key={i} className="text-sm opacity-80">
                <div>{a.title || a.event || "Session"}</div>
                <div className="text-xs opacity-60">{a.ts ? new Date(a.ts).toLocaleString() : "—"}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
