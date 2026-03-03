/**
 * Finalizer Queue — Command Board for office/finalizer, city_manager, admin
 * Daily operations view: filter events by what action is needed
 */
import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventAPI, TaskAPI } from "../components/api/secureApi";
import { calculateReadinessScore } from "../components/crm/pipeline";
import { differenceInDays, format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, Clock, User, Music, ClipboardList,
  CreditCard, FileText, Phone, ArrowRight, ChevronDown, ChevronUp,
  Zap, Calendar, MapPin, RefreshCw
} from "lucide-react";
import DJAssignModal from "../components/events/DJAssignModal";
import QuickTaskModal from "../components/events/QuickTaskModal";

// ─── Filter definitions ──────────────────────────────────────────────────
const QUEUE_FILTERS = [
  { key: "all_upcoming",      label: "All Upcoming",        icon: Calendar,      color: "text-gray-600",   bg: "bg-gray-50" },
  { key: "needs_finalization",label: "Needs Finalization",  icon: ClipboardList, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "at_risk",           label: "At Risk",             icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50" },
  { key: "no_dj",             label: "No DJ Assigned",      icon: User,          color: "text-amber-600",  bg: "bg-amber-50" },
  { key: "no_planning",       label: "Missing Planning",    icon: FileText,      color: "text-blue-600",   bg: "bg-blue-50" },
  { key: "no_timeline",       label: "No Timeline",         icon: Clock,         color: "text-indigo-600", bg: "bg-indigo-50" },
  { key: "no_music",          label: "No Music",            icon: Music,         color: "text-pink-600",   bg: "bg-pink-50" },
  { key: "payment_issue",     label: "Payment Issue",       icon: CreditCard,    color: "text-emerald-600",bg: "bg-emerald-50" },
  { key: "no_contract",       label: "Contract Pending",    icon: FileText,      color: "text-orange-600", bg: "bg-orange-50" },
  { key: "ready_for_dj",      label: "Ready for DJ",        icon: CheckCircle2,  color: "text-emerald-600",bg: "bg-emerald-50" },
];

const SORT_OPTIONS = [
  { key: "days_asc",       label: "Days Until Event ↑" },
  { key: "readiness_asc",  label: "Readiness (worst first)" },
  { key: "readiness_desc", label: "Readiness (best first)" },
  { key: "event_date",     label: "Event Date" },
  { key: "city",           label: "City" },
];

const EXCLUDED_STATUSES = new Set(["cancelled", "completed"]);

// ─── Flag evaluation ─────────────────────────────────────────────────────
function evaluateFlags(event) {
  const score = calculateReadinessScore(event);
  const today = new Date();
  const eventDate = event.event_date ? new Date(event.event_date) : null;
  const days = eventDate ? differenceInDays(eventDate, today) : 999;

  return {
    score,
    days,
    isUpcoming: days >= 0,
    isAtRisk: days <= 30 && score < 80,
    noDJ: !event.assigned_dj,
    noPlanning: !event.planning_complete,
    noTimeline: !event.timeline_complete,
    noMusic: !event.music_complete,
    noContract: !event.contract_signed,
    // paymentIssue: only flag if deposit/balance are truly missing (unpaid),
    // but ignore $0 placeholder records — those indicate unpriced events, not true payment issues.
    paymentIssue: !event.deposit_paid || (!event.balance_paid && days <= 30),
    needsFinalization: days <= 60 && !event.dj_briefed,
    readyForDJ: !!(event.planning_complete && event.timeline_complete && event.music_complete &&
                    event.assigned_dj && event.final_call_completed && event.balance_paid),
  };
}

function filterEvents(events, filterKey) {
  const decorated = events
    .filter(e => ACTIVE_STATUSES.includes(e.status) && !e.is_deleted)
    .map(e => ({ ...e, _flags: evaluateFlags(e) }))
    .filter(e => e._flags.isUpcoming);

  switch (filterKey) {
    case "all_upcoming":      return decorated;
    case "needs_finalization":return decorated.filter(e => e._flags.needsFinalization);
    case "at_risk":           return decorated.filter(e => e._flags.isAtRisk);
    case "no_dj":             return decorated.filter(e => e._flags.noDJ);
    case "no_planning":       return decorated.filter(e => e._flags.noPlanning);
    case "no_timeline":       return decorated.filter(e => e._flags.noTimeline);
    case "no_music":          return decorated.filter(e => e._flags.noMusic);
    case "payment_issue":     return decorated.filter(e => e._flags.paymentIssue);
    case "no_contract":       return decorated.filter(e => e._flags.noContract);
    case "ready_for_dj":      return decorated.filter(e => e._flags.readyForDJ);
    default:                  return decorated;
  }
}

function sortEvents(events, sortKey) {
  return [...events].sort((a, b) => {
    switch (sortKey) {
      case "days_asc":       return a._flags.days - b._flags.days;
      case "readiness_asc":  return a._flags.score - b._flags.score;
      case "readiness_desc": return b._flags.score - a._flags.score;
      case "event_date":     return new Date(a.event_date) - new Date(b.event_date);
      case "city":           return (a.city || "").localeCompare(b.city || "");
      default:               return a._flags.days - b._flags.days;
    }
  });
}

// ─── Status chips shown on each event card ────────────────────────────────
function FlagChips({ flags }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {flags.noContract && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">No Contract</span>}
      {!flags.noContract && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Contract ✓</span>}
      {flags.noPlanning && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">No Planning</span>}
      {!flags.noPlanning && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Planning ✓</span>}
      {flags.noTimeline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">No Timeline</span>}
      {!flags.noTimeline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Timeline ✓</span>}
      {flags.noMusic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 font-medium">No Music</span>}
      {!flags.noMusic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Music ✓</span>}
      {flags.paymentIssue && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">Payment ⚠️</span>}
    </div>
  );
}

// ─── Readiness bar ────────────────────────────────────────────────────────
function ReadinessBar({ score }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-500";
  const text  = score >= 80 ? "text-emerald-700" : score >= 50 ? "text-amber-700" : "text-red-700";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${text}`}>{score}%</span>
    </div>
  );
}

// ─── Days badge ───────────────────────────────────────────────────────────
function DaysBadge({ days }) {
  const cls = days <= 7 ? "bg-red-100 text-red-700 border-red-200" :
              days <= 14 ? "bg-amber-100 text-amber-700 border-amber-200" :
              days <= 30 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
              "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {days === 0 ? "TODAY" : days === 1 ? "Tomorrow" : `${days}d`}
    </span>
  );
}

// ─── Event row card ───────────────────────────────────────────────────────
function EventQueueCard({ event, onAssignDJ, onCreateTask, onMarkReadyForDJ, queryClient }) {
  const flags = event._flags;
  const canMarkReady = !flags.noPlanning && !flags.noTimeline && !flags.noMusic && event.assigned_dj && event.final_call_completed && !event.balance_paid === false;

  const handleMarkFinalCall = async () => {
    await EventAPI.update(event.id, { final_call_completed: true });
    queryClient.invalidateQueries(["finalizer-events"]);
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 transition-all hover:shadow-md ${
      flags.isAtRisk && flags.days <= 14 ? "border-red-200 ring-1 ring-red-100" :
      flags.days <= 7 ? "border-amber-200" : "border-gray-200"
    }`}>
      <div className="flex items-start gap-4">
        {/* Left: days badge */}
        <div className="flex-shrink-0 w-14 text-center pt-0.5">
          <DaysBadge days={flags.days} />
          {event.event_date && (
            <p className="text-[10px] text-gray-400 mt-1">{format(new Date(event.event_date), "MMM d")}</p>
          )}
        </div>

        {/* Center: event info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link to={createPageUrl("EventDetail") + `?id=${event.id}`} className="font-semibold text-gray-900 hover:text-violet-600 text-sm leading-tight">
                {event.event_name}
              </Link>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                {event.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{event.city}</span>}
                {event.venue_name && <span>· {event.venue_name}</span>}
                <span className="capitalize">· {event.event_type?.replace(/_/g, " ")}</span>
              </div>
            </div>
            <ReadinessBar score={flags.score} />
          </div>

          <FlagChips flags={flags} />

          {/* DJ Assignment row */}
          <div className="flex items-center gap-2 mt-2">
            {event.assigned_dj ? (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400" />
                {event.assigned_dj}
                {event.dj_briefed && <span className="ml-1 text-emerald-500">✓ briefed</span>}
              </span>
            ) : (
              <span className="text-xs text-amber-600 flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5" />
                No DJ assigned
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
        <Link to={createPageUrl("EventDetail") + `?id=${event.id}`}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            Open <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>

        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onAssignDJ(event)}>
          <User className="w-3 h-3" /> Assign DJ
        </Button>

        {!event.final_call_completed && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={handleMarkFinalCall}>
            <Phone className="w-3 h-3" /> Mark Final Call ✓
          </Button>
        )}

        {canMarkReady && (
          <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onMarkReadyForDJ(event)}>
            <CheckCircle2 className="w-3 h-3" /> Mark Ready for DJ
          </Button>
        )}

        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 ml-auto text-gray-500" onClick={() => onCreateTask(event)}>
          <ClipboardList className="w-3 h-3" /> Task
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function FinalizerQueue() {
  const [activeFilter, setActiveFilter] = useState("needs_finalization");
  const [sortKey, setSortKey] = useState("days_asc");
  const [cityFilter, setCityFilter] = useState("all");
  const [assigningDJ, setAssigningDJ] = useState(null);
  const [creatingTask, setCreatingTask] = useState(null);
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["finalizer-events", cityFilter],
    queryFn: () => EventAPI.list(
      cityFilter !== "all" ? { city: cityFilter } : {},
      "event_date",
      500,
      0,
      todayStr,
      null
    ).then(raw => Array.isArray(raw) ? raw : (raw?.events ?? [])),
    staleTime: 60000,
  });

  const cities = useMemo(() => [...new Set(events.map(e => e.city).filter(Boolean))].sort(), [events]);

  const processedEvents = useMemo(() => {
    let filtered = filterEvents(events, activeFilter);
    if (cityFilter !== "all") filtered = filtered.filter(e => e.city === cityFilter);
    return sortEvents(filtered, sortKey);
  }, [events, activeFilter, sortKey, cityFilter]);

  // Counts per filter for sidebar badges
  const counts = useMemo(() => {
    const decorated = events
      .filter(e => ACTIVE_STATUSES.includes(e.status) && !e.is_deleted)
      .map(e => ({ ...e, _flags: evaluateFlags(e) }))
      .filter(e => e._flags.isUpcoming);

    return {
      all_upcoming: decorated.length,
      needs_finalization: decorated.filter(e => e._flags.needsFinalization).length,
      at_risk: decorated.filter(e => e._flags.isAtRisk).length,
      no_dj: decorated.filter(e => !e.assigned_dj).length,
      no_planning: decorated.filter(e => e._flags.noPlanning).length,
      no_timeline: decorated.filter(e => e._flags.noTimeline).length,
      no_music: decorated.filter(e => e._flags.noMusic).length,
      payment_issue: decorated.filter(e => e._flags.paymentIssue).length,
      no_contract: decorated.filter(e => e._flags.noContract).length,
      ready_for_dj: decorated.filter(e => e._flags.readyForDJ).length,
    };
  }, [events]);

  const handleMarkReadyForDJ = async (event) => {
    await EventAPI.update(event.id, { status: "dj_assigned", dj_briefed: true });
    queryClient.invalidateQueries(["finalizer-events"]);
  };

  const currentFilterDef = QUEUE_FILTERS.find(f => f.key === activeFilter);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto py-4">
        <div className="px-4 mb-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Queue Filters</p>
        </div>
        <nav className="space-y-0.5 px-2">
          {QUEUE_FILTERS.map(f => {
            const Icon = f.icon;
            const count = counts[f.key] || 0;
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive ? `${f.bg} ${f.color} font-semibold` : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? f.color : "text-gray-400"}`} />
                <span className="flex-1 text-left text-xs">{f.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-white/70" :
                    f.key === "at_risk" && count > 0 ? "bg-red-100 text-red-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {currentFilterDef && React.createElement(currentFilterDef.icon, { className: `w-4 h-4 ${currentFilterDef.color}` })}
            <h1 className="text-base font-bold text-gray-900">{currentFilterDef?.label}</h1>
            <Badge variant="secondary" className="text-xs">{processedEvents.length}</Badge>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {cities.length > 1 && (
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="h-8 w-32 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={sortKey} onValueChange={setSortKey}>
              <SelectTrigger className="h-8 w-44 text-xs bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </div>
        </div>

        {/* Event list */}
        <div className="p-6 space-y-3">
          {isLoading && (
            <div className="text-center py-20 text-gray-400 text-sm">Loading events…</div>
          )}

          {!isLoading && processedEvents.length === 0 && (
            <div className="text-center py-20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nothing in this queue</p>
              <p className="text-gray-400 text-sm mt-1">
                {activeFilter === "ready_for_dj" ? "No events are fully ready for DJ yet." : "All caught up! 🎉"}
              </p>
            </div>
          )}

          {processedEvents.map(event => (
            <EventQueueCard
              key={event.id}
              event={event}
              onAssignDJ={setAssigningDJ}
              onCreateTask={setCreatingTask}
              onMarkReadyForDJ={handleMarkReadyForDJ}
              queryClient={queryClient}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {assigningDJ && (
        <DJAssignModal
          event={assigningDJ}
          onClose={() => setAssigningDJ(null)}
          onSaved={() => { setAssigningDJ(null); queryClient.invalidateQueries(["finalizer-events"]); }}
        />
      )}
      {creatingTask && (
        <QuickTaskModal
          relatedEvent={creatingTask}
          onClose={() => setCreatingTask(null)}
          onSaved={() => { setCreatingTask(null); queryClient.invalidateQueries(["finalizer-events"]); }}
        />
      )}
    </div>
  );
}