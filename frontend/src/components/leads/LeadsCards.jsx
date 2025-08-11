// 📁 src/components/leads/LeadsCards.jsx
import React from "react";
import { Calendar, User, Building2, Brain, Phone, Mail, Edit3 } from "lucide-react";

export default function LeadsCards({ leads = [], onOpenLead }) {
  const count = Array.isArray(leads) ? leads.length : 0;

  if (!count) {
    return (
      <div className="p-6 text-center text-gray-400">
        No leads available. Try adding a new lead.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {leads.map((raw) => {
        // 🔒 Defensive normalization
        const id =
          raw.id || raw.lead_id || raw.uuid || `${raw.name || raw.title}-${raw.created_at || raw.createdAt || Math.random()}`;
        const name = raw.name || raw.title || raw.full_name || "Unnamed Lead";
        const stage = (raw.stage || raw.pipeline_stage || raw.status_stage || "New") + "";
        const status = raw.status || raw.lead_status || null;

        const company =
          raw.company?.name ||
          raw.company_name ||
          raw.company ||
          raw.account?.name ||
          null;

        const owner =
          raw.owner?.name ||
          raw.assigned_user?.name ||
          raw.assigned_to?.name ||
          raw.owner_name ||
          raw.assigned_user_name ||
          null;

        const aiScore = raw.ai_score ?? raw.aiScore ?? raw.quality_score ?? null;

        const created =
          raw.created_at || raw.createdAt || raw.inserted_at || raw.created || null;

        return (
          <div
            key={id}
            onClick={() => onOpenLead && onOpenLead(raw.id || raw.lead_id || null)}
            className="group cursor-pointer bg-gradient-to-br from-gray-900/80 to-gray-800/80 
                       backdrop-blur-md border border-white/10 rounded-2xl shadow-lg 
                       p-5 transition-all hover:scale-[1.02] hover:shadow-2xl"
          >
            {/* Top: Name + Stage */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-white truncate">{name}</h2>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStageColor(stage)}`}>
                {stage}
              </span>
            </div>

            {/* Company */}
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
              <Building2 size={16} className="text-gray-400" />
              <span className="truncate">{company || "No company"}</span>
            </div>

            {/* Owner */}
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
              <User size={16} className="text-gray-400" />
              <span>{owner || "Unassigned"}</span>
            </div>

            {/* Status */}
            {status && (
              <div className="mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  {status}
                </span>
              </div>
            )}

            {/* AI Score */}
            <div className="flex items-center gap-2 mb-4">
              <Brain size={16} className="text-green-400" />
              <span className="text-sm text-gray-200">
                AI Score: {aiScore ?? "-"}
              </span>
            </div>

            {/* Bottom: Date + Hover actions */}
            <div className="flex justify-between items-center text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                {created ? new Date(created).toLocaleDateString() : "-"}
              </div>
              <div
                className="opacity-0 group-hover:opacity-100 flex gap-2 transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <button className="p-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Edit3 size={14} />
                </button>
                <button className="p-1 rounded-full bg-green-600 hover:bg-green-700 text-white">
                  <Phone size={14} />
                </button>
                <button className="p-1 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white">
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
    closed: "bg-red-500/20 text-red-400",
  };
  return map[s] || "bg-gray-500/20 text-gray-400";
}
