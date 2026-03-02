import React from "react";
import { format } from "date-fns";
import { CalendarDays, MapPin, DollarSign, ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const STATUS_LABELS = {
  booked_pending: { label: "Booked", color: "bg-yellow-50 text-yellow-700" },
  booked: { label: "Booked", color: "bg-blue-50 text-blue-700" },
  planning_in_progress: { label: "Planning", color: "bg-violet-50 text-violet-700" },
  finalized: { label: "Finalized", color: "bg-emerald-50 text-emerald-700" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-500" },
  postponed: { label: "Postponed", color: "bg-orange-50 text-orange-600" },
};

export default function EventCard({ event, showPayCta = true }) {
  const statusMeta = STATUS_LABELS[event.status] || { label: event.status, color: "bg-gray-100 text-gray-500" };
  const isLocked = event.planning_lock_at && new Date() >= new Date(event.planning_lock_at);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-tight">{event.event_name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{event.event_type?.replace(/_/g, " ")}</p>
        </div>
        <Badge className={`text-[10px] font-semibold ${statusMeta.color} border-0`}>{statusMeta.label}</Badge>
      </div>

      {/* Date / Venue */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {event.event_date && (
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {format(new Date(event.event_date), "MMMM d, yyyy")}
          </span>
        )}
        {event.venue_name && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {event.venue_name}
          </span>
        )}
        {isLocked && (
          <span className="flex items-center gap-1 text-amber-600">
            <Lock className="w-3.5 h-3.5" /> Planning locked
          </span>
        )}
      </div>

      {/* Balance */}
      {event.remaining_balance > 0 && (
        <div className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg w-fit">
          <DollarSign className="w-3.5 h-3.5" />
          Balance due: <span className="font-bold">${event.remaining_balance?.toLocaleString()}</span>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link to={createPageUrl(`ClientPortal?view=detail&event_id=${event.id || event.event_id}`)}>
          <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8">
            Event Details <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <Link to={createPageUrl(`ClientPortal?view=planning&event_id=${event.id || event.event_id}`)}>
          <Button size="sm" className="text-xs gap-1.5 h-8 bg-violet-600 hover:bg-violet-700">
            Plan My Event
          </Button>
        </Link>
        {showPayCta && event.remaining_balance > 0 && event.payment_link && (
          <a href={event.payment_link} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <DollarSign className="w-3.5 h-3.5" /> Make Payment
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}