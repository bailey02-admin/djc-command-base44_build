import React, { useState } from "react";
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
import { format, differenceInDays } from "date-fns";
import { Plus, Search, CalendarDays, MapPin, User, Music, CheckCircle2 } from "lucide-react";

const statusColors = {
  booked: "bg-blue-50 text-blue-700",
  planning_in_progress: "bg-violet-50 text-violet-700",
  awaiting_planning_form: "bg-yellow-50 text-yellow-700",
  final_call_scheduled: "bg-indigo-50 text-indigo-700",
  finalized: "bg-purple-50 text-purple-700",
  dj_assigned: "bg-cyan-50 text-cyan-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  event_completed: "bg-green-50 text-green-700",
  survey_sent: "bg-amber-50 text-amber-700",
  closed_won: "bg-gray-100 text-gray-600",
  closed_issue: "bg-red-50 text-red-700",
};

const PAGE_SIZE = 50;

// Default: upcoming 90 days
const todayStr = () => new Date().toISOString().split("T")[0];
const plus90 = () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

export default function Events() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [skip, setSkip] = useState(0);
  const [allEvents, setAllEvents] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const { data, isFetching } = useQuery({
    queryKey: ["events", statusFilter, skip],
    queryFn: () => EventAPI.list(
      statusFilter !== "all" ? { status: statusFilter } : {},
      "event_date",
      PAGE_SIZE,
      skip,
      todayStr(),
      plus90()
    ),
    keepPreviousData: true,
  });

  React.useEffect(() => {
    if (data) {
      if (skip === 0) {
        setAllEvents(data);
      } else {
        setAllEvents(prev => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
  }, [data, skip]);

  // Reset pagination when filters change
  React.useEffect(() => { setSkip(0); setAllEvents([]); }, [statusFilter]);

  const filtered = allEvents.filter(e => {
    return !search || e.event_name?.toLowerCase().includes(search.toLowerCase()) || e.contact_name?.toLowerCase().includes(search.toLowerCase());
  });

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
          <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm bg-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9 text-sm bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(event => {
          const daysUntil = event.event_date ? differenceInDays(new Date(event.event_date), new Date()) : null;
          const readiness = [event.planning_complete, event.timeline_complete, event.music_complete, event.contract_signed, event.deposit_paid].filter(Boolean).length;
          return (
            <Link key={event.id} to={createPageUrl("EventDetail") + `?id=${event.id}`}>
              <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate group-hover:text-violet-700 transition-colors">{event.event_name}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{event.event_type?.replace(/_/g, " ")}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${statusColors[event.status]}`}>
                    {event.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                  {event.event_date && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {format(new Date(event.event_date), "EEEE, MMMM d, yyyy")}
                      {daysUntil !== null && daysUntil >= 0 && (
                        <Badge variant="outline" className={`text-[10px] ml-auto ${daysUntil <= 7 ? "text-red-600 border-red-200" : daysUntil <= 30 ? "text-amber-600 border-amber-200" : ""}`}>
                          {daysUntil === 0 ? "Today" : `${daysUntil}d`}
                        </Badge>
                      )}
                    </div>
                  )}
                  {event.venue_name && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{event.venue_name}</div>}
                  {event.contact_name && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{event.contact_name}</div>}
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
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">No events found.</div>
        )}
      </div>
    </div>
  );
}