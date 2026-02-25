import React from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const RISK_STYLES = {
  high:   "bg-red-50 border-red-200 text-red-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low:    "bg-yellow-50 border-yellow-200 text-yellow-800",
};

const RISK_ICON_STYLES = {
  high:   "text-red-500",
  medium: "text-amber-500",
  low:    "text-yellow-500",
};

export default function DuplicateWarning({ duplicates, risk, onDismiss, onLinkDuplicate }) {
  if (!duplicates?.length) return null;

  return (
    <div className={`rounded-lg border p-4 mb-4 ${RISK_STYLES[risk] || RISK_STYLES.medium}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${RISK_ICON_STYLES[risk]}`} />
          <div>
            <p className="text-sm font-semibold">
              {risk === "high" ? "Likely duplicate" : "Possible duplicate"} detected
              {" "}({duplicates.length} match{duplicates.length > 1 ? "es" : ""})
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              Review before saving — or dismiss to create anyway.
            </p>
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-current opacity-50 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {duplicates.map(lead => (
          <div key={lead.id} className="flex items-center justify-between gap-2 text-xs bg-white/60 rounded-md px-3 py-2">
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{lead.client_first_name} {lead.client_last_name}</span>
              <span className="ml-2 opacity-70">{lead.email}</span>
              {lead.event_date && (
                <span className="ml-2 opacity-70">
                  · {format(new Date(lead.event_date), "MMM d, yyyy")}
                </span>
              )}
              <Badge variant="secondary" className="ml-2 text-[9px] capitalize py-0">
                {lead.pipeline_stage?.replace(/_/g, " ")}
              </Badge>
              <span className="ml-2 opacity-50 italic">{lead._match_reason}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onLinkDuplicate && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onLinkDuplicate(lead.id)}
                >
                  Link as Duplicate
                </Button>
              )}
              <Link
                to={createPageUrl("LeadDetail") + `?id=${lead.id}`}
                target="_blank"
                className="inline-flex items-center gap-0.5 opacity-60 hover:opacity-100"
              >
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}