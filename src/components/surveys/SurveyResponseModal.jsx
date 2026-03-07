import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Star, CheckCircle2, XCircle, AlertTriangle, MessageSquare } from "lucide-react";

function ScoreBar({ value, max = 10 }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 8 ? "bg-emerald-500" : value >= 6 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{value}/10</span>
    </div>
  );
}

export default function SurveyResponseModal({ eventId, eventName, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["survey-response", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getSurveyResponse", { event_id: eventId });
      return res.data;
    },
  });

  const answerMap = {};
  if (data?.answers) {
    for (const a of data.answers) answerMap[a.question_id] = a;
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Survey Response</h2>
            <p className="text-xs text-gray-400">{eventName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : !data?.response ? (
            <p className="text-center text-gray-400 text-sm py-8">No response found.</p>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-5 flex-wrap">
                {data.response.average_score != null && (
                  <div className="text-center">
                    <p className={`text-3xl font-bold ${
                      data.response.average_score >= 8 ? "text-emerald-700" :
                      data.response.average_score >= 6 ? "text-amber-700" : "text-red-700"
                    }`}>
                      {data.response.average_score}
                      <span className="text-base font-normal text-gray-400">/10</span>
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Average Score</p>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  {data.response.low_score_flag && (
                    <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 gap-1">
                      <AlertTriangle className="w-3 h-3" /> Low Score Alert
                    </Badge>
                  )}
                  {data.response.submitted_at && (
                    <p className="text-xs text-gray-500">
                      Submitted {new Date(data.response.submitted_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
                      })}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 capitalize">
                    By: {data.response.created_by_actor_type}
                  </p>
                </div>
              </div>

              {/* Questions & Answers */}
              {data.questions?.length > 0 && (
                <div className="space-y-4">
                  {data.questions.map((q, i) => {
                    const ans = answerMap[q.id];
                    return (
                      <div key={q.id} className="space-y-1.5">
                        <p className="text-sm font-medium text-gray-800">
                          <span className="text-gray-400 text-xs mr-1.5">Q{i + 1}</span>
                          {q.question_text}
                          {q.category && <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{q.category}</span>}
                        </p>
                        {!ans ? (
                          <p className="text-xs text-gray-300 italic pl-4">No answer</p>
                        ) : q.question_type === "rating_1_10" && ans.rating_value != null ? (
                          <div className="pl-4">
                            <ScoreBar value={ans.rating_value} />
                          </div>
                        ) : q.question_type === "yes_no" ? (
                          <div className="pl-4 flex items-center gap-1.5">
                            {ans.boolean_value === true ? (
                              <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm font-medium text-emerald-700">Yes</span></>
                            ) : ans.boolean_value === false ? (
                              <><XCircle className="w-4 h-4 text-red-400" /><span className="text-sm font-medium text-red-600">No</span></>
                            ) : (
                              <span className="text-xs text-gray-300 italic">No answer</span>
                            )}
                          </div>
                        ) : q.question_type === "text" ? (
                          <div className="pl-4">
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                              {ans.text_value || <span className="text-gray-300 italic">No answer</span>}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comments summary */}
              {data.response.comments_summary && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> Comments
                  </p>
                  <p className="text-sm text-gray-700">{data.response.comments_summary}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
        </div>
      </div>
    </div>
  );
}