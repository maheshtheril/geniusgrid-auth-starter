import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, Activity, ShieldAlert, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

// --- Helpers ---
function toISO(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

function lastNDays(n = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (n - 1));
  return { from: toISO(start), to: toISO(end) };
}

async function apiJson(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => (v !== undefined && v !== null) && url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error((await res.json()).message || `HTTP ${res.status}`);
  return res.json();
}

// --- Component ---
export default function DashboardWidget() {
  const [{ from, to }, setRange] = useState(lastNDays(30));
  const [companyId, setCompanyId] = useState(""); // optional filter, keep blank to ignore
  const [metric, setMetric] = useState("active_users");

  const [sales, setSales] = useState([]);
  const [usage, setUsage] = useState([]);
  const [health, setHealth] = useState([]);
  const [modules, setModules] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    return sales.reduce(
      (acc, r) => ({
        orders: acc.orders + Number(r.orders_count || 0),
        revenue: acc.revenue + Number(r.orders_amount || 0),
        invoices: acc.invoices + Number(r.invoices_amount || 0),
        cash: acc.cash + Number(r.cash_collected || 0)
      }),
      { orders: 0, revenue: 0, invoices: 0, cash: 0 }
    );
  }, [sales]);

  const todayHealth = useMemo(() => {
    if (!health.length) return { errors_5xx: 0, auth_failures: 0 };
    return health[health.length - 1];
  }, [health]);

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const [salesData, usageData, healthData, mods] = await Promise.all([
        apiJson("/api/dashboard/sales-daily", { from, to, companyId: companyId || undefined }),
        apiJson("/api/dashboard/usage-daily", { from, to, metric }),
        apiJson("/api/dashboard/health", { from, to }),
        apiJson("/api/modules/installed")
      ]);
      setSales(salesData);
      setUsage(usageData);
      setHealth(healthData);
      setModules(mods);
    } catch (e) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* initial load */ }, []);

  const onApplyRange = () => refresh();

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Controls */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Usage metric</label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_users">Active Users</SelectItem>
                  <SelectItem value="api_calls">API Calls</SelectItem>
                  <SelectItem value="orders_created">Orders Created</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Company (optional)</label>
              <Input placeholder="UUID or leave blank" value={companyId} onChange={e => setCompanyId(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={onApplyRange} disabled={loading} className="w-full">
                {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <RefreshCw className="h-4 w-4 mr-2"/>}
                Apply
              </Button>
            </div>
          </div>
          {error && (
            <div className="text-red-600 text-sm mt-3">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} title="Orders" value={totals.orders.toLocaleString()} subtitle="Sum in range" />
        <MetricCard icon={<Activity className="h-5 w-5" />} title="Revenue" value={totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} subtitle="Orders amount" />
        <MetricCard icon={<Activity className="h-5 w-5" />} title="Invoices" value={totals.invoices.toLocaleString(undefined, { maximumFractionDigits: 2 })} subtitle="Invoices amount" />
        <MetricCard icon={<Activity className="h-5 w-5" />} title="Cash" value={totals.cash.toLocaleString(undefined, { maximumFractionDigits: 2 })} subtitle="Collected" />
      </div>

      {/* Sales Area Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle>Sales (Daily)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales} margin={{ top: 8, left: 8, right: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="c1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopOpacity={0.35} />
                    <stop offset="95%" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopOpacity={0.35} />
                    <stop offset="95%" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="c3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopOpacity={0.35} />
                    <stop offset="95%" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickFormatter={(v) => v?.slice(5)} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="orders_amount" name="Orders Amount" strokeOpacity={1} fillOpacity={0.2} fill="url(#c1)" />
                <Area type="monotone" dataKey="invoices_amount" name="Invoices Amount" strokeOpacity={1} fillOpacity={0.2} fill="url(#c2)" />
                <Area type="monotone" dataKey="cash_collected" name="Cash Collected" strokeOpacity={1} fillOpacity={0.2} fill="url(#c3)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Usage Sparkline */}
      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle>Usage: {metric}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usage} margin={{ top: 8, left: 8, right: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickFormatter={(v) => v?.slice(5)} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="value" name={metric} strokeOpacity={1} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5"/>Auth & API Health</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Auth failures (today)</span>
              <span className="font-medium text-foreground">{Number(todayHealth.auth_failures || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>5xx errors (today)</span>
              <span className="font-medium text-foreground">{Number(todayHealth.errors_5xx || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle>Installed Modules</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {modules.map(m => (
                <motion.div key={m.module_code}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="px-3 py-2 rounded-2xl bg-muted text-sm shadow-sm">
                  <span className="mr-1">{m.icon || "🧩"}</span>
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{m.category}</span>
                </motion.div>
              ))}
              {!modules.length && (
                <div className="text-sm text-muted-foreground">No modules installed yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, subtitle }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">{icon}{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
