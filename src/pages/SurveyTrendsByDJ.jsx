import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, TrendingUp, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/components/finance/exportCsv";
import SurveyReportFilters from "@/components/surveys/SurveyReportFilters";
import SurveyScoreBadge from "@/components/surveys/SurveyScoreBadge";

export default function SurveyTrendsByDJ() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ date_from: "", date_to: "", city: "", dj_id: "" });

  const { data: djData } = useQuery({
    queryKey: ["dj-profiles-list"],
    queryFn: () => base44.entities.DJProfile.list("full_name", 500),
    initialData: [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["survey-trends-dj", filters],
    queryFn: () => base44.functions.invoke("getSurveyTrendsByDJ", filters).then(r => r.data),
    keepPreviousData: true,
  });

  const rows = data?.rows || [];

  const handleExport = () => {
    const csvRows = rows.map(r => ({
      "DJ Name": r.assigned_dj_name,
      "City": r.city,
      "# Surveys": r.survey_count,
      "Avg Score": r.average_score ?? "",
      "Low Score Count": r.low_score_count,
      "Most Recent Survey": r.most_recent_submitted_at ? format(new Date(r.most_recent_submitted_at), "yyyy-MM-dd") : "",
      "Last Event": r.most_recent_event_name || "",
    }));
    exportToCsv(`survey-dj-trends-${format(new Date(), "yyyy-MM-dd")}.csv`, csvRows);
  };

  const openDJResponses = (djId) => {
    navigate(createPageUrl(`SurveyResponsesReport?dj_id=${djId}`));
  };

  const scoreBarWidth = (score) => {
    if (score == null) return 0;
    return Math.round((score / 10) * 100);
  };

  const scoreBarColor = (score) => {
    if (score == null) return "bg-gray-200";
    if (score >= 8) return "bg-emerald-400";
    if (score >= 6) return "bg-amber-400";
    return "bg-red-400";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-violet-500" /> DJ Survey Trends
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${rows.length} DJs with survey data`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0} className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <SurveyReportFilters
        filters={filters}
        onChange={setFilters}
        djs={djData || []}
      />

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No survey data found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">DJ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"># Surveys</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-56">Avg Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Low Scores</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Most Recent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Event</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <tr key={row.assigned_dj_id || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{row.assigned_dj_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.city && <Badge variant="outline" className="text-xs">{row.city}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{row.survey_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SurveyScoreBadge score={row.average_score} />
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[80px]">
                          <div
                            className={`h-full rounded-full transition-all ${scoreBarColor(row.average_score)}`}
                            style={{ width: `${scoreBarWidth(row.average_score)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.low_score_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" /> {row.low_score_count}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {row.most_recent_submitted_at ? format(new Date(row.most_recent_submitted_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.most_recent_event_id ? (
                        <a
                          href={createPageUrl(`EventDetail?id=${row.most_recent_event_id}`)}
                          className="text-xs text-gray-600 hover:text-violet-600 transition-colors line-clamp-1"
                        >
                          {row.most_recent_event_name || "—"}
                        </a>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.assigned_dj_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => openDJResponses(row.assigned_dj_id)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> All Responses
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}