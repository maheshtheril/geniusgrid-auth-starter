// 📁 src/components/leads/LeadsCards.jsx
import React from "react";
import { Calendar, User, Building2, Brain, Phone, Mail, Edit3 } from "lucide-react";

export default function LeadsCards({ leads, onOpenLead }) {
  if (!leads || leads.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        No leads available. Try adding a new lead.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {leads.map((lead) => (
        <div
          key={lead.id}
          onClick={() => onOpenLead(lead.id)}
          className="group cursor-pointer bg-gradient-to-br from-gray-900/80 to-gray-800/80 
                     backdrop-blur-md border border-white/10 rounded-2xl shadow-lg 
                     p-5 transition-all hover:scale-[1.02] hover:shadow-2xl"
        >
          {/* Top: Name + Stage */}
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-white truncate">{lead.name}</h2>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStageColor(lead.stage)}`}>
              {lead.stage || "New"}
            </span>
          </div>

          {/* Company */}
          <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
            <Building2 size={16} className="text-gray-400" />
            <span className="truncate">{lead.company || "No company"}</span>
          </div>

          {/* Owner */}
          <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
            <User size={16} className="text-gray-400" />
            <span>{lead.owner || "Unassigned"}</span>
          </div>

          {/* AI Score */}
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-green-400" />
            <span className="text-sm text-gray-200">
              AI Score: {lead.ai_score ?? "-"}
            </span>
          </div>

          {/* Bottom: Date + Actions */}
          <div className="flex justify-between items-center text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              {lead.created_at
                ? new Date(lead.created_at).toLocaleDateString()
                : "-"}
            </div>
            <div
              className="opacity-0 group-hover:opacity-100 flex gap-2 transition-all"
              onClick={(e) => e.stopPropagation()} // Prevent opening drawer on button click
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
      ))}
    </div>
  );
}

// Stage color mapping
function getStageColor(stage) {
  const map = {
    proposal: "bg-purple-500/20 text-purple-400",
    qualified: "bg-green-500/20 text-green-400",
    new: "bg-blue-500/20 text-blue-400",
    closed: "bg-red-500/20 text-red-400",
  };
  return map[stage?.toLowerCase()] || "bg-gray-500/20 text-gray-400";
}
