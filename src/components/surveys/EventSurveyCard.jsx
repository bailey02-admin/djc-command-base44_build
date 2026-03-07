import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star, AlertTriangle, CheckCircle2, ClipboardList,
  Eye, Loader2, ChevronDown, ChevronUp, User
} from "lucide-react";
import SurveyResponseModal from "./SurveyResponseModal";
import StaffSurveyModal from "./StaffSurveyModal";

export default function EventSurveyCard({ event }) {
  const queryClient = useQueryClient();
  const [showResponse, setShowResponse] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["survey-config", event.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("getEventSurveyConfig", { event_id: event.id });
      return res.data;
    },
    enabled: !!event.id,
  });

  const flagColor = (flag) => {
    if (!flag) return "";
    if (flag === "low_score") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  const scoreColor = (score) => {
    if (score == null) return "text-gray-400";
    if (score >= 8) return "text-emerald-700";
    if (score >= 6) return "text-amber-700";
    return "text-red-700";
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading survey info…
        </CardContent>
      </Card>
    );
  }

  const hasResponse = config?.has_response;
  const isEligible = config?.is_eligible;
  const template = config?.selected_template;
  const response = config?.existing_response;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-violet-500" /> Post-Event Survey
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Status row */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasResponse ? (
              <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Response Received
              </Badge>
            ) : isEligible ? (
              <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50 gap-1">
                <ClipboardList className="w-3 h-3" /> Awaiting Response
              </Badge>
            ) : (
              <Badge variant="outline" className="border-gray-200 text-gray-400 gap-1">
                Not eligible yet
              </Badge>
            )}

            {event.survey_flag === "low_score" && (
              <Badge variant="outline" className={`gap-1 ${flagColor("low_score")}`}>
                <AlertTriangle className="w-3 h-3" /> Low Score Alert
              </Badge>
            )}
          </div>

          {/* Score display */}
          {response?.average_score != null && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className={`text-2xl font-bold ${scoreColor(response.average_score)}`}>
                  {response.average_score}<span className="text-sm font-normal text-gray-400">/10</span>
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Avg Score</p>
              </div>
              {response.submitted_at && (
                <div>
                  <p className="text-xs text-gray-500">
                    Submitted {new Date(response.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    by {response.created_by_actor_type === "client" ? "client" : "staff"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Template info */}
          {template && (
            <p className="text-xs text-gray-500">
              Template: <span className="font-medium text-gray-700">{template.name}</span>
            </p>
          )}

          {!template && !hasResponse && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
              No active survey template matched for this event type/city.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-1">
            {hasResponse && (
              <Button variant="outline" size="sm" onClick={() => setShowResponse(true)} className="text-xs gap-1">
                <Eye className="w-3.5 h-3.5" /> View Response
              </Button>
            )}
            {!hasResponse && isEligible && template && (
              <Button
                size="sm"
                onClick={() => setShowSubmit(true)}
                className="text-xs gap-1 bg-violet-600 hover:bg-violet-700"
              >
                <ClipboardList className="w-3.5 h-3.5" /> Submit Survey (Staff)
              </Button>
            )}
          </div>

          {!isEligible && !hasResponse && (
            <p className="text-[10px] text-gray-400">{config?.ineligible_reason}</p>
          )}
        </CardContent>
      </Card>

      {showResponse && (
        <SurveyResponseModal
          eventId={event.id}
          eventName={event.event_name}
          onClose={() => setShowResponse(false)}
        />
      )}

      {showSubmit && config?.selected_template && (
        <StaffSurveyModal
          event={event}
          template={config.selected_template}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => {
            queryClient.invalidateQueries(["survey-config", event.id]);
            setShowSubmit(false);
          }}
        />
      )}
    </>
  );
}