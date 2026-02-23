import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import { CalendarDays, MapPin, User } from "lucide-react";

export default function UpcomingEvents({ events }) {
  if (!events?.length) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No upcoming events.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.slice(0, 6).map(event => {
        const daysUntil = differenceInDays(new Date(event.event_date), new Date());
        const urgentClass = daysUntil <= 7 ? "border-l-rose-500" : daysUntil <= 30 ? "border-l-amber-500" : "border-l-violet-500";

        return (
          <Link
            key={event.id}
            to={createPageUrl("EventDetail") + `?id=${event.id}`}
            className={`block p-3 rounded-lg border border-l-[3px] ${urgentClass} bg-white hover:shadow-sm transition-all`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{event.event_name}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {format(new Date(event.event_date), "MMM d")}
                  </span>
                  {event.venue_name && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {event.venue_name}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                {daysUntil <= 0 ? "Today" : `${daysUntil}d`}
              </Badge>
            </div>
          </Link>
        );
      })}
    </div>
  );
}