import "flag-icons/css/flag-icons.min.css";
// ---------- FILE: src/pages/CompaniesPage.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus, Search, LayoutGrid, List } from "lucide-react";
import { Panel, Toolbar } from "@/pages/crm/_shared/Surface";
import CompanyCreateDrawer from "@/pages/crm/companies/CompanyCreateDrawer.jsx";
import { COMPANIES as SEED, createCompany } from "@/pages/crm/companies/mockApi";

export default function CompaniesPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [view, setView] = useState("table"); // "table" | "grid"

  useEffect(() => setRows(SEED.slice()), []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.name, r.domain, r.industry, r.owner, r.city, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [rows, q]);

  const handleCreate = async (form) => {
    const created = await createCompany(form);
    setRows((prev) => [created, ...prev]);
    setOpenCreate(false);
    nav(`/app/crm/companies/${created.id}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <Panel className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-2xl grid place-items-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(var(--gg-primary),.20), rgba(var(--gg-accent),.20))",
            }}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Companies</h1>
            <p className="text-sm text-muted-foreground">
              Accounts with linked people, deals, and activity.
            </p>
          </div>
          <div className="flex-1" />

          {/* View toggle */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            <button
              className={`gg-btn ${view === "table" ? "is-active" : ""}`}
              onClick={() => setView("table")}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              className={`gg-btn ${view === "grid" ? "is-active" : ""}`}
              onClick={() => setView("grid")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <button
            className="gg-btn gg-btn--primary"
            onClick={() => setOpenCreate(true)}
          >
            <Plus className="h-4 w-4" /> New Company
          </button>
        </div>
      </Panel>

      {/* Toolbar (search / filters / export) */}
      <Panel className="p-3">
        <div className="flex items-center gap-3 justify-between">
          <div className="relative w-full max-w-md">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
            <input
              className="h-9 pl-8 pr-3 w-full rounded-lg border bg-background"
              placeholder="Search name, domain, industry, owner, city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Toolbar onFilter={() => {}} onExport={() => {}} />
          </div>
        </div>
      </Panel>

      {/* Content */}
      <Panel className="p-0">
        {view === "table" ? (
          <CompaniesTable rows={filtered} />
        ) : (
          <CompaniesGrid rows={filtered} />
        )}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            No companies found.
          </div>
        )}
      </Panel>

      <CompanyCreateDrawer
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

/* ---------- Table view ---------- */
function CompaniesTable({ rows }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-[#0f1217]/90 backdrop-blur border-b border-white/10">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium [&>th]:text-left">
            <th>Company</th>
            <th>Domain</th>
            <th>Industry</th>
            <th>Owner</th>
            <th>Location</th>
            <th />
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-white/10">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-white/5 transition-colors">
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <Avatar name={r.name} />
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.id}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">{r.domain || "-"}</td>
              <td className="px-3 py-3">{r.industry || "-"}</td>
              <td className="px-3 py-3">{r.owner || "-"}</td>
              <td className="px-3 py-3">
                {(r.city || "-") + (r.country ? `, ${r.country}` : "")}
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-right">
                <Link
                  to={`/app/crm/companies/${r.id}`}
                  className="h-8 px-2 rounded-lg border text-xs inline-flex items-center"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Card grid view ---------- */
function CompaniesGrid({ rows }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
      {rows.map((r) => (
        <div key={r.id} className="gg-panel p-4">
          <div className="flex items-center gap-3">
            <Avatar name={r.name} size={40} />
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.domain || "—"}
              </div>
            </div>
            <div className="flex-1" />
            <Link
              to={`/app/crm/companies/${r.id}`}
              className="h-8 px-2 rounded-lg border text-xs inline-flex items-center"
            >
              Open
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Info label="Industry" value={r.industry || "—"} />
            <Info label="Owner" value={r.owner || "—"} />
            <Info
              label="Location"
              value={(r.city || "—") + (r.country ? `, ${r.country}` : "")}
              span
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Small UI helpers (local) ---------- */
function Avatar({ name = "?", size = 28 }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hues = [215, 260, 200, 160, 300, 20];
  const h = hues[(name.charCodeAt(0) || 0) % hues.length];
  const bg = `linear-gradient(135deg, hsl(${h} 70% 25% / .6), hsl(${(h + 40) %
    360} 70% 25% / .6))`;
  return (
    <div
      className="grid place-items-center rounded-xl border border-white/10 text-xs font-semibold"
      style={{ width: size, height: size, background: bg }}
      title={name}
    >
      {initials}
    </div>
  );
}
function Info({ label, value, span = false }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}
