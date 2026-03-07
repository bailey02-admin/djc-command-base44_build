import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LeadAPI } from "@/components/api/secureApi";
import { Phone, Mail, Calendar } from "lucide-react";

const PIPELINE_STAGES = [
  { key: "new_inquiry", label: "New", color: "bg-blue-500" },
  { key: "qualified", label: "Qualified", color: "bg-indigo-500" },
  { key: "consultation_scheduled", label: "Consult Scheduled", color: "bg-violet-500" },
  { key: "consultation_completed", label: "Consult Done", color: "bg-purple-500" },
  { key: "quote_sent", label: "Quote Sent", color: "bg-fuchsia-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { key: "deposit_requested", label: "Deposit Req.", color: "bg-orange-500" },
  { key: "booked", label: "Booked", color: "bg-emerald-500" },
];

export default function LeadPipelineKanban({ leads, onRefresh }) {
  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDrop = async (e, stage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) {
      // Route through mutateLead so all transition + field validation gates apply
      await LeadAPI.advanceStage(leadId, { pipeline_stage: stage }).catch(() => {
        // If transition is invalid (e.g. dropping to a non-adjacent stage), silently ignore —
        // the backend 422 is the authoritative rejection; UI will re-render unchanged on refresh
      });
      onRefresh?.();
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {PIPELINE_STAGES.map(stage => {
        const stageLeads = leads.filter(l => l.pipeline_stage === stage.key);
        return (
          <div
            key={stage.key}
            className="flex-shrink-0 w-64 bg-gray-50/80 rounded-xl p-3"
            onDrop={(e) => handleDrop(e, stage.key)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{stage.label}</h3>
              <span className="text-xs text-gray-400 ml-auto">{stageLeads.length}</span>
            </div>
            <div className="space-y-2">
              {stageLeads.map(lead => (
                <Link
                  key={lead.id}
                  to={createPageUrl("LeadDetail") + `?id=${lead.id}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="block p-3 bg-white rounded-lg border border-gray-200/60 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {lead.client_first_name} {lead.client_last_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {lead.event_type?.replace(/_/g, " ")}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-gray-400">
                    {lead.event_date && (
                      <span className="flex items-center gap-1 text-[10px]">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(lead.event_date), "MMM d")}
                      </span>
                    )}
                    {lead.city && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {lead.city}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
              {stageLeads.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-300">
                  Drop leads here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}