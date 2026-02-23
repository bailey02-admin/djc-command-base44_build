import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { calculateSLAStatus, SLA_BADGE } from "../crm/pipeline";

export default function SLABadge({ lead }) {
  const status = lead.sla_status || calculateSLAStatus(lead.inquiry_date, lead.first_response_date);
  
  const labels = {
    on_time:        "SLA ✓",
    warning:        "SLA Warning",
    missed:         "SLA Missed",
    not_applicable: "No SLA",
  };

  const elapsed = lead.sla_minutes_elapsed;
  const label = labels[status] || "SLA";

  return (
    <Badge variant="outline" className={`text-[10px] border ${SLA_BADGE[status]} flex items-center gap-1`}>
      <Clock className="w-2.5 h-2.5" />
      {label}
      {elapsed !== null && elapsed !== undefined && <span className="opacity-70">({elapsed}m)</span>}
    </Badge>
  );
}