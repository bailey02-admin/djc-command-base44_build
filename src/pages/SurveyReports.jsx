import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, TrendingUp, AlertTriangle, ChevronRight, Loader2, Eye, Star, CheckCircle2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import SurveyScoreBadge from "@/components/surveys/SurveyScoreBadge";

const SURVEY_REPORT_LINKS = [
  {
    page: "SurveyResponsesReport",
    icon: ClipboardList,
    label: "All Survey Responses",
    description: "All submitted surveys with scores, DJ, event, and recovery status",
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200",
  },
  {
    page: "SurveyTrendsByDJ",
    icon: TrendingUp,
    label: "DJ Survey Trends",
    description: "Aggregated score trends per DJ with low-score tracking",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  {
    page: "SurveyLowScoreQueue",
    icon: AlertTriangle,
    label: "Low Score / Recovery Queue",
    description: "All low-scoring surveys and their service recovery task status",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
];

export default function SurveyReports() {
  const navigate = useNavigate();

  // Fetch all responses for KPI computation (limit 2000, no filters)
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ["survey-kpi-all"],
    queryFn: () => base44.functions.invoke("getSurveyResponsesReport", { limit: 2000, skip: 0 }).then(r => r.data),
  });

  // Fetch open recovery tasks for KPI
  const { data: recoveryData } = useQuery({
    queryKey: ["survey-recovery-open"],
    queryFn: () => base44.functions.invoke("getLowScoreRecoveryQueue", { task_status: "pending", limit: 500, skip: 0 }).then(r => r.data),
  });

  const allRows = kpiData?.rows || [];
  const total = kpiData?.total ?? allRows.length;
  const scored = allRows.filter(r => r.average_score != null);
  const avgScore = scored.length > 0
    ? Math.round((scored.reduce((s, r) => s + r.average_score, 0) / scored.length) * 10) / 10
    : null;
  const lowScoreCount = allRows.filter(r => r.low_score_flag).length;
  const openRecoveryCount = recoveryData?.total ?? (recoveryData?.rows?.length ?? 0);

  // Latest 10 for the preview table
  const rows = allRows.slice(0, 10);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Survey Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Post-event feedback analytics and service recovery tracking</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Responses */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Responses</p>
          {kpiLoading ? (
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          )}
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> All time</p>
        </div>

        {/* Avg Score */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Avg Score</p>
          {kpiLoading ? (
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${avgScore == null ? "text-gray-300" : avgScore >= 8 ? "text-emerald-700" : avgScore >= 6 ? "text-amber-700" : "text-red-700"}`}>
              {avgScore != null ? <>{avgScore}<span className="text-sm font-normal text-gray-400">/10</span></> : "—"}
            </p>
          )}
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><Star className="w-3 h-3" /> Across {scored.length} scored</p>
        </div>

        {/* Low Score Count */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Low Scores</p>
          {kpiLoading ? (
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${lowScoreCount > 0 ? "text-red-700" : "text-gray-900"}`}>{lowScoreCount}</p>
          )}
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Flagged responses</p>
        </div>

        {/* Open Recovery Tasks */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Open Recovery</p>
          <p className={`text-2xl font-bold ${openRecoveryCount > 0 ? "text-amber-700" : "text-gray-900"}`}>{openRecoveryCount}</p>
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pending tasks</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SURVEY_REPORT_LINKS.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.page}
              onClick={() => navigate(createPageUrl(item.page))}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left hover:shadow-sm transition-all ${item.bg}`}
            >
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${item.color}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${item.color}`}>{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            </button>
          );
        })}
      </div>

      {/* Latest Survey Results */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Latest Survey Results</h2>
          <Button variant="ghost" size="sm" className="text-xs text-violet-600 gap-1" onClick={() => navigate(createPageUrl("SurveyResponsesReport"))}>
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No survey responses yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">DJ</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Flag</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(row => (
                    <tr key={row.survey_response_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {row.submitted_at ? format(new Date(row.submitted_at), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={createPageUrl(`EventDetail?id=${row.event_id}`)}
                          className="text-sm font-medium text-gray-900 hover:text-violet-600 transition-colors"
                        >
                          {row.event_name || "—"}
                        </a>
                        <p className="text-xs text-gray-400">{row.contact_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.city && <Badge variant="outline" className="text-xs">{row.city}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.assigned_dj_name || "—"}</td>
                      <td className="px-4 py-3">
                        <SurveyScoreBadge score={row.average_score} />
                      </td>
                      <td className="px-4 py-3">
                        {row.low_score_flag && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" /> Low
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => navigate(createPageUrl(`EventDetail?id=${row.event_id}`))}
                        >
                          <Eye className="w-3.5 h-3.5" /> Event
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}