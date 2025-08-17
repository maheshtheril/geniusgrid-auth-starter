// ---------- FILE: src/pages/crm/deals/DealsLayout.jsx (No Help) ----------
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Plus, Upload, Download, Search } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEnv } from "@/store/useEnv";

import DealDrawer from "./DealDrawer";
import { STAGES, createDeal } from "./mockApi";

const TABS = [
  { to: "/app/crm/deals/pipeline", label: "Pipeline" },
  { to: "/app/crm/deals/list", label: "List" },
];

export default function DealsLayout(){
  const loc = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const searchRef = useRef(null);
  const { API_BASE } = useEnv?.() || { API_BASE: "/api" };

  const [kpi, setKpi] = useState({ total: 0, weighted: 0, win_rate: 0, active: 0 });
  const [loading, setLoading] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const initialDraft = useMemo(() => ({
    title: "",
    company: "",
    amount: 0,
    stage: STAGES?.[0]?.id || "new",
    owner: "",
    probability: 0.2,
    tags: [],
    next_step: "",
  }), []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_BASE}/deals/summary`, { params: { q } });
        if (!cancel) setKpi({
          total: Number(data?.total_amount || 0),
          weighted: Number(data?.weighted_amount || 0),
          win_rate: Number(data?.win_rate || 0),
          active: Number(data?.active_count || 0),
        });
      } catch (e) {
        console.warn(e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [API_BASE, q]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (!typing && (e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setShowNew(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSearch = (val) => {
    const next = new URLSearchParams(params);
    if (val) next.set("q", val); else next.delete("q");
    setParams(next, { replace: false });
  };

  const handleCreate = async (form) => {
    const saved = await createDeal(form);
    window.dispatchEvent(new CustomEvent("deals:created", { detail: { id: saved.id } }));
    setShowNew(false);
  };

  const currencyINR = (n) => typeof n === "number"
    ? n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    : "—";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-b from-background to-muted/30 p-3 md:p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center shadow-inner">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Deals</h1>
            <p className="text-sm text-muted-foreground">Manage pipeline and close faster with AI assistance.</p>
          </div>
          <div className="flex-1" />

          {/* Actions: desktop */}
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                ref={searchRef}
                defaultValue={q}
                onChange={(e)=>onSearch(e.target.value)}
                placeholder="Search deals, companies… (/)"
                className="pl-8 h-9 w-[280px] shadow-sm focus:shadow focus:ring-0"
              />
            </div>
            <Button onClick={()=>setShowNew(true)} className="gap-2 shadow hover:shadow-md active:scale-[0.99] transition">
              <Plus className="h-4"/> New Deal
            </Button>
            <Button variant="secondary" className="gap-2" onClick={()=>navigate("/app/crm/deals/import")}>
              <Upload className="h-4"/> Import
            </Button>
            <Button variant="secondary" className="gap-2" onClick={()=>navigate(`/app/crm/deals/export?q=${encodeURIComponent(q)}`)}>
              <Download className="h-4"/> Export
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Total Pipeline" value={currencyINR(kpi.total)} loading={loading} />
        <KpiCard title="Weighted Value" value={currencyINR(kpi.weighted)} loading={loading} />
        <KpiCard title="Win Rate" value={`${Math.round((kpi.win_rate||0)*100)}%`} loading={loading} />
        <KpiCard title="Active Deals" value={kpi.active?.toLocaleString?.() || 0} loading={loading} />
      </div>

      {/* Tabs */}
      <div className="w-full overflow-x-auto sticky top-0 z-10 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-muted">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to}
              className={({isActive}) => `px-4 h-9 inline-flex items-center rounded-lg whitespace-nowrap text-sm transition ${
                isActive || loc.pathname.startsWith(t.to) ? 'bg-background shadow-sm border' : 'hover:bg-background/60'
              }`}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-2xl border p-3 md:p-4">
        <Outlet context={{ openNewDeal: () => setShowNew(true) }} />
      </div>

      {/* New Deal Drawer */}
      <DealDrawer
        open={showNew}
        onClose={()=>setShowNew(false)}
        deal={initialDraft}
        onSave={handleCreate}
      />
    </div>
  );
}

function KpiCard({ title, value, loading }){
  return (
    <Card className="hover:shadow-sm transition">
      <CardHeader className="py-3">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums leading-tight">
          {loading ? <span className="inline-block h-6 w-24 rounded bg-muted animate-pulse"/> : value}
        </div>
      </CardContent>
    </Card>
  );
}
