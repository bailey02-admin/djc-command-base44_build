/**
 * Staff Timeline View — /StaffTimelineView?event_id=xxx&type=PRIMARY
 * Read-only formatted timeline with header
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Printer } from "lucide-react";

export default function StaffTimelineView() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get("event_id");
  const timelineType = urlParams.get("type") || "PRIMARY";
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["staff-timeline", eventId, timelineType],
    queryFn: async () => {
      const r = await base44.functions.invoke("getStaffTimeline", { event_id: eventId, timeline_type: timelineType });
      return r.data;
    },
    enabled: !!eventId,
  });

  const timeline = data?.timeline;
  const activities = data?.activities || [];

  if (!eventId) return <div className="p-8 text-center text-gray-400">No event_id provided.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-gray-500">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-900">Timeline View</h1>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl("StaffTimelineManager") + `?event_id=${eventId}&type=${timelineType}`}>
            <Button variant="outline" size="sm" className="gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({length:8}).map((_,i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden print:shadow-none print:border-0">
          {/* Header */}
          {(timeline?.header_title || timeline?.header_subtitle) && (
            <div className="bg-gray-800 text-white px-6 py-5 text-center">
              {timeline.header_title && <h2 className="text-xl font-bold">{timeline.header_title}</h2>}
              {timeline.header_subtitle && <p className="text-sm text-gray-300 mt-1">{timeline.header_subtitle}</p>}
            </div>
          )}

          {activities.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No timeline activities yet.
              <div className="mt-3">
                <Link to={createPageUrl("StaffTimelineManager") + `?event_id=${eventId}&type=${timelineType}`}>
                  <Button size="sm" variant="outline" className="gap-1"><Pencil className="w-3.5 h-3.5" /> Build Timeline</Button>
                </Link>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide w-32">Time</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Activity</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide">Comments</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act, idx) => (
                  <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-700 whitespace-nowrap">{act.time_display || "—"}</td>
                    <td className="px-5 py-3 text-sm text-gray-900 font-medium">{act.activity_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{act.comments || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}