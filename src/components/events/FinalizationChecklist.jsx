/**
 * Event Finalization Checklist — Phase 2C
 * Shows required items before an event can be marked Finalized/Ready for DJ.
 * Tracks completion, warns on "client changed after review" scenario.
 */
import React from "react";
import { CheckCircle2, Circle, AlertTriangle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";

const FINALIZATION_ITEMS = [
  { key: "contract_signed",       label: "Contract signed",           category: "legal",    blocking: true },
  { key: "deposit_paid",          label: "Deposit received",          category: "payment",  blocking: true },
  { key: "planning_complete",     label: "Planning form completed",   category: "planning", blocking: true },
  { key: "timeline_complete",     label: "Event timeline built",      category: "planning", blocking: true },
  { key: "music_complete",        label: "Music selections done",     category: "music",    blocking: true },
  { key: "pronunciation_complete",label: "Pronunciation list done",   category: "planning", blocking: false },
  { key: "special_songs_complete",label: "Special songs confirmed",   category: "music",    blocking: false },
  { key: "balance_paid",          label: "Final balance collected",   category: "payment",  blocking: true },
  { key: "final_call_completed",  label: "Final call completed",      category: "ops",      blocking: true },
  { key: "assigned_dj",          label: "DJ assigned",               category: "ops",      blocking: true, isString: true },
  { key: "dj_briefed",           label: "DJ briefed",                category: "ops",      blocking: true },
  { key: "internal_notes_reviewed", label: "Internal notes reviewed", category: "ops",      blocking: false },
];

const CATEGORY_COLOR = {
  legal:   "text-violet-600",
  payment: "text-emerald-600",
  planning:"text-blue-600",
  music:   "text-pink-600",
  ops:     "text-amber-600",
};

export default function FinalizationChecklist({ event, onToggle }) {
  if (!event) return null;

  const daysUntilEvent = event.event_date
    ? differenceInDays(new Date(event.event_date), new Date())
    : null;

  const completed = FINALIZATION_ITEMS.filter(item =>
    item.isString ? !!event[item.key] : event[item.key]
  );
  const blocking = FINALIZATION_ITEMS.filter(item => item.blocking && !(item.isString ? !!event[item.key] : event[item.key]));
  const pct = Math.round((completed.length / FINALIZATION_ITEMS.length) * 100);

  const isWithin14 = daysUntilEvent !== null && daysUntilEvent <= 14 && daysUntilEvent >= 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Finalization Checklist</span>
          {blocking.length === 0
            ? <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">✓ Ready for DJ</Badge>
            : <Badge className="bg-amber-100 text-amber-700 text-[10px]">{blocking.length} blocking</Badge>}
        </div>
        <span className="text-sm font-bold text-gray-500">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
      </div>

      {/* Late-change warning */}
      {isWithin14 && event.dj_briefed && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Client changes after DJ briefing should trigger a re-briefing task.</span>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1">
        {FINALIZATION_ITEMS.map(item => {
          const done = item.isString ? !!event[item.key] : event[item.key];
          const canClick = !item.isString && onToggle;
          return (
            <div
              key={item.key}
              onClick={() => canClick && onToggle(item.key, !done)}
              className={`flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm transition-colors ${canClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
            >
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : item.blocking
                  ? <Circle className="w-4 h-4 text-red-300 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <span className={`flex-1 ${done ? "text-gray-400 line-through" : item.blocking ? "text-gray-800 font-medium" : "text-gray-600"}`}>
                {item.label}
              </span>
              <div className="flex items-center gap-1">
                {item.isString && event[item.key] && <span className="text-[10px] text-gray-400">{event[item.key]}</span>}
                {item.blocking && !done && <Lock className="w-2.5 h-2.5 text-red-300" />}
                <span className={`text-[9px] font-semibold uppercase ${CATEGORY_COLOR[item.category]}`}>{item.category}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}