/**
 * ChangeHistoryPanel — shows the last 10 client-side changes for an event.
 * Reads from the ChangeLog entity filtered by this event's related_id.
 * Shows: field changed, old → new value, timestamp, who changed it.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { AlertTriangle, Clock, Music, CalendarRange, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORY_META = {
  music:      { label: "Music",    color: "bg-pink-50 text-pink-700 border-pink-100",     icon: Music },
  timeline:   { label: "Timeline", color: "bg-blue-50 text-blue-700 border-blue-100",     icon: CalendarRange },
  planning:   { label: "Planning", color: "bg-violet-50 text-violet-700 border-violet-100", icon: ClipboardList },
  status:     { label: "Status",   color: "bg-gray-50 text-gray-600 border-gray-200",     icon: Clock },
  assignment: { label: "Assignment", color: "bg-amber-50 text-amber-700 border-amber-100", icon: Clock },
  financial:  { label: "Financial", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: Clock },
  general:    { label: "General",  color: "bg-gray-50 text-gray-500 border-gray-200",     icon: Clock },
};

function truncate(str, n = 60) {
  if (!str) return "—";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export default function ChangeHistoryPanel({ eventId }) {
  const { data: changes = [], isLoading } = useQuery({
    queryKey: ["change-history", eventId],
    queryFn: () => base44.entities.ChangeLog.filter({ related_id: eventId }, "-created_date", 10),
    enabled: !!eventId,
  });

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading history…</p>;
  if (changes.length === 0) return (
    <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
      <Clock className="w-8 h-8 opacity-30" />
      <p className="text-sm">No client changes recorded yet.</p>
      <p className="text-xs">Changes appear here after a client edits planning, music, or timeline fields.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">Showing last {changes.length} client changes</p>
      {changes.map(c => {
        const meta = CATEGORY_META[c.change_category] || CATEGORY_META.general;
        const Icon = meta.icon;
        return (
          <div
            key={c.id}
            className={`flex items-start gap-3 px-3 py-3 rounded-xl border ${c.is_critical ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}
          >
            {/* Icon */}
            <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
              {c.is_critical
                ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                : <Icon className="w-3.5 h-3.5" />}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              {/* Field + category badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-800">
                  {c.field_name?.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${meta.color}`}>
                  {meta.label}
                </Badge>
                {c.is_critical && (
                  <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200">critical</Badge>
                )}
              </div>

              {/* old → new */}
              <div className="flex items-start gap-1.5 text-xs text-gray-500">
                {c.old_value ? (
                  <>
                    <span className="line-through text-gray-400 max-w-[180px] truncate" title={c.old_value}>
                      {truncate(c.old_value)}
                    </span>
                    <span className="text-gray-300 flex-shrink-0">→</span>
                  </>
                ) : null}
                <span className="font-medium text-gray-700 max-w-[240px]" title={c.new_value}>
                  {truncate(c.new_value, 80)}
                </span>
              </div>

              {/* Meta: who + when */}
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span className="font-medium text-gray-500">{c.changed_by || "system"}</span>
                <span>·</span>
                <span>{c.created_date ? format(new Date(c.created_date), "MMM d, yyyy 'at' h:mm a") : ""}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}