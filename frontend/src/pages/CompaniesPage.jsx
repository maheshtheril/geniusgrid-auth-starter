// src/pages/CompaniesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus, Search } from "lucide-react";

// Pull demo data from the new companies mock API
import { COMPANIES as SEED } from "@/pages/crm/companies/mockApi";

export default function CompaniesPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    // Seed from mock; in real app replace with fetch
    setRows(SEED.slice());
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      (r.name || "").toLowerCase().includes(s) ||
      (r.domain || "").toLowerCase().includes(s) ||
      (r.industry || "").toLowerCase().includes(s) ||
      (r.owner || "").toLowerCase().includes(s) ||
      (r.city || "").toLowerCase().includes(s) ||
      (r.country || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Accounts with linked people, deals, and activity.
          </p>
        </div>
        <div className="flex-1" />
        <button
          className="h-9 px-3 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-2"
          onClick={() => {
            // For now, just jump to an example company detail
            // Replace with a real "New Company" drawer later.
            nav("/app/crm/companies/acme");
          }}
        >
          <Plus className="h-4 w-4" /> New Company
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
          <input
            className="h-9 pl-8 pr-3 w-full rounded-lg border bg-background"
            placeholder="Search name, domain, industry, owner, city…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border p-3 md:p-4 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["Name", "Domain", "Industry", "Owner", "Location", "Actions"].map(h => (
                <th key={h} className="px-3 py-2 font-medium text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No companies found.
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.domain || "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.industry || "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.owner || "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {(r.city || "-") + (r.country ? `, ${r.country}` : "")}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
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

        {/* Quick links to demo IDs if you want to jump fast */}
        <div className="text-xs text-muted-foreground mt-3">
          Demo IDs: <Link className="underline" to="/app/crm/companies/acme">acme</Link>,{" "}
          <Link className="underline" to="/app/crm/companies/abc">abc</Link>
        </div>
      </div>
    </div>
  );
}
