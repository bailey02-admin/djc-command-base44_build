import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const statusColors = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  attempted_contact: "bg-yellow-50 text-yellow-700 border-yellow-200",
  contacted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  qualified: "bg-violet-50 text-violet-700 border-violet-200",
  proposal_sent: "bg-purple-50 text-purple-700 border-purple-200",
  follow_up: "bg-orange-50 text-orange-700 border-orange-200",
  booked: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-red-50 text-red-700 border-red-200",
  ghosted: "bg-gray-50 text-gray-700 border-gray-200",
  disqualified: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function RecentLeads({ leads }) {
  if (!leads?.length) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No leads yet. Create your first lead to get started.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {leads.slice(0, 8).map(lead => (
        <Link
          key={lead.id}
          to={createPageUrl("LeadDetail") + `?id=${lead.id}`}
          className="flex items-center justify-between py-3 px-1 hover:bg-gray-50/50 rounded-lg transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
              {lead.client_first_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                {lead.client_first_name} {lead.client_last_name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {lead.event_type?.replace(/_/g, " ")} • {lead.city || "No city"}
                {lead.event_date && ` • ${format(new Date(lead.event_date), "MMM d, yyyy")}`}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${statusColors[lead.status] || ""}`}>
            {lead.status?.replace(/_/g, " ")}
          </Badge>
        </Link>
      ))}
    </div>
  );
}