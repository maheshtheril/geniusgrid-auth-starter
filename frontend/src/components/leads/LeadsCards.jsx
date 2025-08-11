// 📁 src/components/leads/LeadsCards.jsx
import React from "react";
import { Calendar, User, Building2, Brain, Phone, Mail, Edit3 } from "lucide-react";

export default function LeadsCards({ leads = [], onOpenLead }) {
  const count = Array.isArray(leads) ? leads.length : 0;

  return (
    <div className="relative">
      {/* 🔎 Dev chip – comment this out later */}
      <div className="absolute -top-2 right-4 text-[10px] px-2 py-1 rounded-full bg-white/10 text-gray-300">
        cards:{count}
      </div>

      {count === 0 ? (
        <div className="p-6 text-center text-gray-400">
          No leads available. Try adding a new lead.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
          {leads.map((raw, i) => {
            const id = raw.id || raw.lead_id || `tmp-${i}`;
            const name = raw.name || raw.title || "Unnamed Lead";
            const stage = (raw.stage || "New") + "";
            const company = raw.company?.name || raw.company_name || raw.company || null;
            const owner =
              raw.owner?.name ||
              raw.assigned_user?.name ||
              raw.owner_name ||
              raw.assigned_user_name ||
              null;
            const aiScore = raw.ai_score ?? raw.aiScore ?? null;
            const created = raw.created_at || raw.createdAt || null;

            return (
              <div
                key={id}
                onClick={() => onOpenLead && onOpenLead(raw.id || raw.lead_id || null)}
                className="group cursor-pointer bg-gradient-to-br from-gray-900/80 to-gray-800/80 
                           backdrop-blur-md border border-white/10 rounded-2xl shadow-lg 
                           p-5 transition-all hover:scale-[1.02] hover:shadow-2xl"
              >
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold text-white truncate">{name}</h2>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStageColor(stage)}`}>
                    {stage}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
                  <Building2 size={16} className="text-gray-400" />
                  <span className="truncate">{company || "No company"}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                  <User size={16} className="text-gray-400" />
                  <span>{owner || "Unassigned"}</span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Brain size={16} className="text-green-400" />
                  <span className="text-sm text-gray-200">AI Score: {aiScore ?? "-"}</span>
                </div>

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
      )}
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
