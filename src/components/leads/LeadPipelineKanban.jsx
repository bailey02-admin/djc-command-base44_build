import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LeadAPI } from "@/components/api/secureApi";
import { Calendar } from "lucide-react";
import usePipelineConfig from "@/components/hooks/usePipelineConfig";

export default function LeadPipelineKanban({ leads, onRefresh }) {
  const { allStages } = usePipelineConfig();

  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData("leadId", leadId);
  };

  const handleDrop = async (e, stageKey) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId) {
      await LeadAPI.advanceStage(leadId, { pipeline_stage: stageKey }).catch(() => {});
      onRefresh?.();
    }
  };

  const handleDragOver = (e) => e.preventDefault();
  const displayStages = allStages.filter((stage) => stage.is_active || leads.some((lead) => lead.pipeline_stage === stage.key));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
      {displayStages.map((stage) => {
        const stageLeads = leads.filter((lead) => lead.pipeline_stage === stage.key);
        return (
          <div
            key={stage.key}
            className="flex-shrink-0 w-64 bg-gray-50/80 rounded-xl p-3"
            onDrop={(e) => handleDrop(e, stage.key)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{stage.label}</h3>
              <span className="text-xs text-gray-400 ml-auto">{stageLeads.length}</span>
            </div>
            <div className="space-y-2">
              {stageLeads.map((lead) => (
                // Drag is on the outer div; Link handles click navigation separately.
                // Never put draggable on <Link> — browsers intercept mousedown for drag,
                // which prevents click-to-navigate from firing.
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <Link
                    to={createPageUrl("LeadDetail") + `?id=${lead.id}`}
                    className="block p-3 bg-white rounded-lg border border-gray-200/60 shadow-sm hover:shadow-md transition-all"
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
                </div>
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