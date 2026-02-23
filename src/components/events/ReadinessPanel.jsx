import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { calculateReadinessScore, getReadinessMissingItems, READINESS_ITEMS } from "../crm/pipeline";
import { differenceInDays } from "date-fns";

export default function ReadinessPanel({ event, onToggle }) {
  const score = calculateReadinessScore(event);
  const missing = getReadinessMissingItems(event);
  const daysUntil = event.event_date ? differenceInDays(new Date(event.event_date), new Date()) : null;

  const urgencyColor =
    score < 40 && daysUntil !== null && daysUntil <= 30 ? "text-red-600" :
    score < 70 ? "text-amber-600" :
    "text-emerald-600";

  const barColor =
    score < 40 ? "bg-red-500" :
    score < 70 ? "bg-amber-500" :
    "bg-emerald-500";

  return (
    <div className="space-y-3">
      {/* Score bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Readiness</span>
          <span className={`text-sm font-bold ${urgencyColor}`}>{score}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-300 rounded-full`} style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Urgency warning */}
      {daysUntil !== null && daysUntil <= 14 && score < 80 && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-100">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span><strong>Urgent:</strong> {daysUntil <= 0 ? "Event today!" : `${daysUntil} days`} — missing critical items</span>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-1">
        {READINESS_ITEMS.map(item => {
          const done = !!event[item.key];
          return (
            <button
              key={item.key}
              onClick={() => onToggle && onToggle(item.key, !done)}
              className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
              }
              <span className={`text-xs ${done ? "text-gray-400 line-through" : "text-gray-700"}`}>{item.label}</span>
              <span className={`text-[10px] ml-auto ${done ? "text-emerald-500" : "text-gray-300"}`}>{item.weight}pts</span>
            </button>
          );
        })}
      </div>

      {missing.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5" /> Event is fully ready!
        </div>
      )}
    </div>
  );
}