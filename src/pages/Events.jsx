import React, { useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { EventAPI } from "../components/api/secureApi";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { Plus, Search, CalendarDays, MapPin, User } from "lucide-react";

const statusColors = {
  booked_pending:       "bg-sky-50 text-sky-700",
  booked:               "bg-blue-50 text-blue-700",
  planning_in_progress: "bg-violet-50 text-violet-700",
  finalized:            "bg-purple-50 text-purple-700",
  completed:            "bg-green-50 text-green-700",
  cancelled:            "bg-red-50 text-red-700",
  postponed:            "bg-amber-50 text-amber-700",
};

const PAGE_SIZE = 25;
const todayStr = () => new Date().toISOString().split("T")[0];
const plus90   = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

// Memoized card — prevents re-renders when other cards change
const EventCard = React.memo(function EventCard({ event }) {
  const daysUntil = event.event_date
    ? differenceInDays(new Date(event.event_date), new Date())
    : null;
  // Use stored readiness_score; fall back to counting booleans only if missing
  const readiness = event.readiness_score != null
    ? Math.round(event.readiness_score / 20) // stored 0–100, display 0–5 bars
    : [event.planning_complete, event.timeline_complete, event.music_complete,
       event.contract_signed, event.deposit_paid].filter(Boolean).length;

  return (
    <Link to={createPageUrl("EventDetail") + `?id=${event.id}`}>
      <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate group-hover:text-violet-700 transition-colors">
              {event.event_name}
            </p>
            <p className="text-xs text-gray-400 capitalize mt-0.5">
              {event.event_type?.replace(/_/g, " ")}
            </p>
          </div>
          <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${statusColors[event.status] || ""}`}>
            {event.status?.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="mt-3 space-y-1.5 text-xs text-gray-500">
          {event.event_date && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}
              {daysUntil !== null && daysUntil >= 0 && (
                <Badge variant="outline" className={`text-[10px] ml-auto ${
                  daysUntil <= 7 ? "text-red-600 border-red-200"
                  : daysUntil <= 30 ? "text-amber-600 border-amber-200" : ""
                }`}>
                  {daysUntil === 0 ? "Today" : `${daysUntil}d`}
                </Badge>
              )}
            </div>
          )}
          {event.venue_name && (
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</div>
          )}
          {event.contact_name && (
            <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{event.contact_name}</div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < readiness ? "bg-emerald-500" : "bg-gray-200"}`} />
          ))}
          <span className="text-[10px] text-gray-400 ml-1">{readiness}/5</span>
        </div>
      </Card>
    </Link>
  );
});

function SkeletonCard() {
  return (
    <Card className="p-5 border-0 shadow-sm space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-36" />
      <div className="flex gap-1 mt-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />)}
      </div>
    </Card>
  );
}

export default function Events() {
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [skip, setSkip]               = useState(0);
  const [accumulated, setAccumulated] = useState([]);

  // Debounce search to avoid re-fetching on every keystroke
  const debounceTimer = React.useRef(null);
  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(val), 300);
  }, []);

  // Reset pagination when filters change
  React.useEffect(() => {
    setSkip(0);
    setAccumulated([]);
  }, [statusFilter]);

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["events", statusFilter, skip],
    queryFn: () => EventAPI.list(
      statusFilter !== "all" ? { status: statusFilter } : {},
      "event_date",
      PAGE_SIZE,
      skip,
      todayStr(),
      plus90()
    ),
    staleTime: 45_000,          // 45 s — avoids redundant refetches on tab focus
    keepPreviousData: true,
    onSuccess: (data) => {
      if (skip === 0) {
        setAccumulated(data);
      } else {
        setAccumulated(prev => [...prev, ...data]);
      }
    },
  });

  // Client-side search filter (only title + contact name, already paginated server-side)
  const filtered = useMemo(() =>
    debouncedSearch
      ? accumulated.filter(e =>
          e.event_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          e.contact_name?.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      : accumulated,
    [accumulated, debouncedSearch]
  );

  const hasMore = data?.length === PAGE_SIZE;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} events</p>
        </div>
        <Link to={createPageUrl("EventForm")}>
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
            <Plus className="w-4 h-4 mr-1.5" /> New Event
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search events…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(statusColors).map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">Upcoming 90 days</span>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map(event => <EventCard key={event.id} event={event} />)
        }
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">No events found.</div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline" size="sm"
            onClick={() => setSkip(s => s + PAGE_SIZE)}
            disabled={isFetching}
          >
            {isFetching ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}