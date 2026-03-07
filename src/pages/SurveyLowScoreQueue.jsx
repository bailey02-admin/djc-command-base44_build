import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertTriangle, Eye, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { exportToCsv } from "@/components/finance/exportCsv";
import SurveyReportFilters from "@/components/surveys/SurveyReportFilters";
import SurveyScoreBadge from "@/components/surveys/SurveyScoreBadge";
import SurveyResponseModal from "@/components/surveys/SurveyResponseModal";

const TASK_STATUS_COLORS = {
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled:   "bg-gray-50 text-gray-400 border-gray-200",
};

export default function SurveyLowScoreQueue() {
  const [filters, setFilters] = useState({ date_from: "", date_to: "", city: "", dj_id: "", task_status: "" });
  const [viewingResponse, setViewingResponse] = useState(null);

  const { data: djData } = useQuery({
    queryKey: ["dj-profiles-list"],
    queryFn: () => base44.entities.DJProfile.list("full_name", 500),
    initialData: [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["low-score-queue", filters],
    queryFn: () => base44.functions.invoke("getLowScoreRecoveryQueue", { ...filters, limit: 500, skip: 0 }).then(r => r.data),
    keepPreviousData: true,
  });

  const rows = data?.rows || [];

  const handleExport = () => {
    const csvRows = rows.map(r => ({
      "Submitted At": r.submitted_at ? format(new Date(r.submitted_at), "yyyy-MM-dd HH:mm") : "",
      "Event Date": r.event_date || "",
      "Event Name": r.event_name,
      "City": r.city,
      "DJ Name": r.assigned_dj_name,
      "Avg Score": r.average_score ?? "",
      "Comments": r.comments_summary || "",
      "Recovery Task": r.recovery_task_title || "",
      "Task Status": r.recovery_task_status || "None",
      "Task Assigned To": r.recovery_task_assigned_to || "",
      "Task Due Date": r.recovery_task_due_date || "",
    }));
    exportToCsv(`low-score-queue-${format(new Date(), "yyyy-MM-dd")}.csv`, csvRows);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" /> Low Score / Recovery Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${data?.total ?? rows.length} flagged responses`}
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
        showTaskStatusFilter
      />

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No low-score responses</p>
            <p className="text-sm text-gray-400 mt-1">Great news — no service recovery needed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">DJ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide max-w-[200px]">Comments</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Task Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => (
                  <tr key={row.survey_response_id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {row.submitted_at ? format(new Date(row.submitted_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {row.event_date ? format(new Date(row.event_date + "T12:00:00"), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={createPageUrl(`EventDetail?id=${row.event_id}`)}
                          className="text-sm font-medium text-gray-900 hover:text-violet-600 transition-colors line-clamp-1"
                        >
                          {row.event_name || "—"}
                        </a>
                        {row.city && <Badge variant="outline" className="text-xs shrink-0">{row.city}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.assigned_dj_name || "—"}</td>
                    <td className="px-4 py-3">
                      <SurveyScoreBadge score={row.average_score} />
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {row.comments_summary ? (
                        <p className="text-xs text-gray-600 line-clamp-2">{row.comments_summary}</p>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.recovery_task_status ? (
                        <Badge variant="outline" className={`text-xs capitalize ${TASK_STATUS_COLORS[row.recovery_task_status] || ""}`}>
                          {row.recovery_task_status.replace("_", " ")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400 border-gray-200">No Task</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {row.recovery_task_assigned_to || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {row.recovery_task_due_date || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-7"
                          onClick={() => setViewingResponse({ event_id: row.event_id, event_name: row.event_name })}
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                        <a href={createPageUrl(`EventDetail?id=${row.event_id}`)}>
                          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingResponse && (
        <SurveyResponseModal
          eventId={viewingResponse.event_id}
          eventName={viewingResponse.event_name}
          onClose={() => setViewingResponse(null)}
        />
      )}
    </div>
  );
}