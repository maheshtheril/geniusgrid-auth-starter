// -----------------------------------------------
// src/pages/DashboardPage.jsx (cards + charts)
// -----------------------------------------------
import { useEnv } from "@/store/useEnv";
import { Icon } from "@/components/ui/Icon";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const demoSeries = [
  { m: "Jan", v: 12 },
  { m: "Feb", v: 18 },
  { m: "Mar", v: 15 },
  { m: "Apr", v: 22 },
  { m: "May", v: 26 },
  { m: "Jun", v: 24 },
];

function StatCard({ icon = "Activity", label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
      <Icon name={icon} className="w-5 h-5" />
      <div>
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
        {hint && <div className="text-[10px] text-white/40">{hint}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { dashboard } = useEnv();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="UserPlus" label="Leads" value={dashboard.leads_total ?? 0} hint="Total in tenant" />
        <StatCard icon="Handshake" label="Deals" value={dashboard.deals_total ?? 0} hint="All stages" />
        <StatCard icon="Bell" label="Unread" value={dashboard.unread_notifications ?? 0} hint="Notifications" />
        <StatCard icon="TrendingUp" label="Win Rate" value="48%" hint="Last 30 days" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm mb-2 text-white/80">Pipeline Trend</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={demoSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopOpacity={0.6} />
                  <stop offset="95%" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="m" tickLine={false} axisLine={false} />
              <YAxis width={30} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="v" strokeWidth={2} fillOpacity={0.3} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}