// 📁 src/components/leads/LeadsCards.jsx
import React from "react";
import { Calendar, User, Building2, Brain, Phone, Mail, Edit3 } from "lucide-react";

// Accepts EITHER `rows` or `leads` + optional `loading`
export default function LeadsCards({ rows, leads, loading = false, onOpenLead }) {
  const items = Array.isArray(rows) ? rows : Array.isArray(leads) ? leads : [];

  if (loading) return <SkeletonGrid />;

  if (!items.length) {
    return (
      <div className="p-6 text-center text-[color:var(--muted)]">
        No leads available. Try adding a new lead.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((r, i) => {
        const id = r.id ?? r.lead_id ?? `tmp-${i}`;
        const name = r.name ?? r.title ?? "Unnamed Lead";
        const company = r.company_name ?? r.company?.name ?? r.company ?? null;
        const owner = r.owner_name ?? r.owner?.name ?? r.assigned_user_name ?? null;
        const stage = String(r.stage ?? "New");
        const status = r.status ?? null;
        const aiScore = r.score ?? r.ai_score ?? null;
        const created = r.created_at ?? r.createdAt ?? null;

        return (
          <div
            key={id}
            onClick={() => onOpenLead && onOpenLead(id)}
            className="group cursor-pointer rounded-2xl gg-panel p-5 shadow-lg transition-transform duration-150 hover:scale-[1.02] hover:shadow-2xl"
          >
            {/* Top: Name + Stage */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="truncate text-lg font-bold text-[color:var(--text)]">{name}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStageColor(stage)}`}>
                {stage}
              </span>
            </div>

            {/* Company */}
            <div className="mb-1 flex items-center gap-2 text-sm text-[color:var(--muted)]">
              <Building2 size={16} className="text-[color:var(--muted)]" />
              <span className="truncate">{company || "No company"}</span>
            </div>

            {/* Owner */}
            <div className="mb-3 flex items-center gap-2 text-sm text-[color:var(--muted)]">
              <User size={16} className="text-[color:var(--muted)]" />
              <span>{owner || "Unassigned"}</span>
            </div>

            {/* Status (optional) */}
            {status && (
              <div className="mb-3">
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                  {status}
                </span>
              </div>
            )}

            {/* AI Score */}
            <div className="mb-4 flex items-center gap-2">
              <Brain size={16} className="text-emerald-400" />
              <span className="text-sm text-[color:var(--text)]">AI Score: {aiScore ?? "-"}</span>
            </div>

            {/* Bottom: Date + Actions */}
            <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                {created ? new Date(created).toLocaleDateString() : "-"}
              </div>

              <div
                className="flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="rounded-full p-1.5 text-white"
                  style={{ background: "color-mix(in oklab, var(--primary) 92%, black 8%)" }}
                  title="Edit"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="rounded-full border border-[color:var(--border)] bg-transparent p-1.5 text-[color:var(--text)] hover:bg-white/10"
                  title="Call"
                >
                  <Phone size={14} />
                </button>
                <button
                  className="rounded-full border border-[color:var(--border)] bg-transparent p-1.5 text-[color:var(--text)] hover:bg-white/10"
                  title="Email"
                >
                  <Mail size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getStageColor(stage) {
  const s = (stage || "").toLowerCase();
  const map = {
    proposal: "bg-purple-500/20 text-purple-400",
    qualified: "bg-green-500/20 text-green-400",
    new: "bg-blue-500/20 text-blue-400",
    prospect: "bg-cyan-500/20 text-cyan-400",
    contacted: "bg-amber-500/20 text-amber-400",
    won: "bg-emerald-500/20 text-emerald-400",
    lost: "bg-rose-500/20 text-rose-400",
    closed: "bg-red-500/20 text-red-400",
  };
  return map[s] || "bg-gray-500/20 text-gray-400";
}

// Loading skeleton (uses theme tokens)
function SkeletonGrid() {
  const cells = Array.from({ length: 8 });
  return (
    <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cells.map((_, i) => (
        <div key={i} className="gg-panel animate-pulse rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-[color:var(--border)]/25" />
            <div className="h-5 w-16 rounded-full bg-[color:var(--border)]/25" />
          </div>
          <div className="h-3 w-32 rounded bg-[color:var(--border)]/25" />
          <div className="h-3 w-24 rounded bg-[color:var(--border)]/25" />
          <div className="h-3 w-20 rounded bg-[color:var(--border)]/25" />
          <div className="h-3 w-28 rounded bg-[color:var(--border)]/25" />
          <div className="flex justify-between">
            <div className="h-3 w-24 rounded bg-[color:var(--border)]/25" />
            <div className="h-6 w-20 rounded-full bg-[color:var(--border)]/25" />
          </div>
        </div>
      ))}
    </div>
  );
}
