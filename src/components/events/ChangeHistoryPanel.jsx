/**
 * Change History Panel — shows field-level change log for an event.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORY_COLOR = {
  music:    "bg-pink-50 text-pink-700",
  timeline: "bg-blue-50 text-blue-700",
  planning: "bg-violet-50 text-violet-700",
  status:   "bg-gray-50 text-gray-600",
  assignment: "bg-amber-50 text-amber-700",
  financial: "bg-emerald-50 text-emerald-700",
  general:  "bg-gray-50 text-gray-500",
};

export default function ChangeHistoryPanel({ eventId }) {
  const { data: changes = [], isLoading } = useQuery({
    queryKey: ["change-history", eventId],
    queryFn: () => base44.entities.ChangeLog.filter({ related_id: eventId }, "-created_date", 40),
    enabled: !!eventId,
  });

  if (isLoading) return <p className="text-xs text-gray-400 py-4 text-center">Loading history…</p>;
  if (changes.length === 0) return <p className="text-xs text-gray-400 py-8 text-center">No changes recorded yet.</p>;

  return (
    <div className="space-y-1">
      {changes.map(c => (
        <div key={c.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${c.is_critical ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
          <div className="flex-shrink-0 mt-0.5">
            {c.is_critical
              ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              : <Clock className="w-3.5 h-3.5 text-gray-300" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700">{c.field_name?.replace(/_/g, " ")}</span>
              <Badge variant="secondary" className={`text-[9px] ${CATEGORY_COLOR[c.change_category] || ""}`}>{c.change_category}</Badge>
              {c.is_critical && <Badge className="text-[9px] bg-red-100 text-red-700">critical</Badge>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
              <span className="line-through opacity-60">{c.old_value || "—"}</span>
              <span>→</span>
              <span className="font-medium text-gray-700">{c.new_value || "—"}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              {c.changed_by || "system"} · {c.created_date ? format(new Date(c.created_date), "MMM d, h:mm a") : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}