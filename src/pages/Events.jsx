import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInDays } from "date-fns";
import {
  Plus, Search, CalendarDays, MapPin, User, Filter, X,
  ExternalLink, Loader2, ChevronDown
} from "lucide-react";

// ─── constants ────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const PAGE_SIZE = 25;
const ALLOWED_IMPERSONATE = new Set(["admin", "city_manager", "office_finalizer"]);

const STATUS_OPTIONS = [
  { value: "booked_pending",       label: "Booked Pending",       color: "bg-sky-50 text-sky-700" },
  { value: "booked",               label: "Booked",               color: "bg-blue-50 text-blue-700" },
  { value: "planning_in_progress", label: "Planning In Progress", color: "bg-violet-50 text-violet-700" },
  { value: "finalized",            label: "Finalized",            color: "bg-purple-50 text-purple-700" },
  { value: "completed",            label: "Completed",            color: "bg-green-50 text-green-700" },
  { value: "cancelled",            label: "Cancelled",            color: "bg-red-50 text-red-700" },
  { value: "postponed",            label: "Postponed",            color: "bg-amber-50 text-amber-700" },
];
const STATUS_COLOR = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.color]));

const CITY_OPTIONS = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];

const COMPLETION_FLAGS = [
  { key: "planning_complete",      label: "Planning" },
  { key: "timeline_complete",      label: "Timeline" },
  { key: "music_complete",         label: "Music" },
  { key: "contract_signed",        label: "Contract" },
  { key: "deposit_paid",           label: "Deposit" },
  { key: "balance_paid",           label: "Balance" },
  { key: "final_call_completed",   label: "Final Call" },
  { key: "dj_briefed",             label: "DJ Briefed" },
];

// Saved views — each entry returns { filters, serverFilters, clientFilters }
const SAVED_VIEWS = [
  {
    label: "All Upcoming",
    value: "all_upcoming",
    filters: {},
    clientFilters: {},
  },
  {
    label: "Needs DJ Assigned",
    value: "needs_dj",
    filters: { assigned_dj_id: "__unassigned__" },
    clientFilters: {},
  },
  {
    label: "Incomplete Planning",
    value: "incomplete_planning",
    filters: {},
    clientFilters: { incomplete_flags: ["planning_complete", "timeline_complete", "music_complete"] },
  },
  {
    label: "Payment Issues",
    value: "payment_issues",
    filters: {},
    clientFilters: { incomplete_flags: ["deposit_paid", "balance_paid"] },
  },
  {
    label: "Finalization Needed",
    value: "finalization_needed",
    filters: {},
    clientFilters: { incomplete_flags: ["final_call_completed", "dj_briefed"] },
  },
  {
    label: "Cancelled",
    value: "cancelled",
    filters: { status: "cancelled" },
    clientFilters: {},
  },
  {
    label: "Completed",
    value: "completed",
    filters: { status: "completed" },
    clientFilters: {},
  },
];

// ─── EventCard ────────────────────────────────────────────────────────────────
const EventCard = React.memo(function EventCard({ event, canImpersonate }) {
  const [impersonating, setImpersonating] = useState(false);
  const [impError, setImpError] = useState(null);

  const daysUntil = event.event_date
    ? differenceInDays(new Date(event.event_date), new Date())
    : null;
  const readiness = event.readiness_score != null
    ? Math.round(event.readiness_score / 20)
    : [event.planning_complete, event.timeline_complete, event.music_complete,
       event.contract_signed, event.deposit_paid].filter(Boolean).length;

  const handleViewAsClient = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!event.contact_id) { setImpError("No contact linked"); return; }
    setImpersonating(true);
    setImpError(null);
    try {
      const res = await base44.functions.invoke("createImpersonationSession", { event_id: event.id });
      if (res.data?.ok && res.data?.redirect_url) {
        window.open(res.data.redirect_url, "_blank", "noopener,noreferrer");
      } else {
        setImpError(res.data?.error || "Failed");
      }
    } catch (err) {
      setImpError(err?.response?.data?.error || "Not authorized");
    } finally {
      setImpersonating(false);
    }
  };

  return (
    <Link to={createPageUrl("EventDetail") + `?id=${event.id}`}>
      <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate group-hover:text-violet-700 transition-colors">
              {event.event_name}
            </p>
            <p className="text-xs text-gray-400 capitalize mt-0.5">
              {event.event_type?.replace(/_/g, " ")}
              {event.city && <span className="ml-1 text-gray-300">· {event.city}</span>}
            </p>
          </div>
          <Badge variant="secondary" className={`text-[10px] flex-shrink-0 ${STATUS_COLOR[event.status] || ""}`}>
            {event.status?.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-gray-500">
          {event.event_date && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {format(new Date(event.event_date), "EEE, MMM d, yyyy")}
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

        {/* View as Client button — intercepts click, does NOT navigate */}
        {canImpersonate && event.contact_id && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleViewAsClient}
              disabled={impersonating}
              className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 border border-indigo-100 hover:border-indigo-300 rounded px-2 py-0.5 transition-colors bg-white"
            >
              {impersonating
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ExternalLink className="w-3 h-3" />}
              View as Client
            </button>
            {impError && <span className="text-[10px] text-red-500">{impError}</span>}
          </div>
        )}
      </Card>
    </Link>
  );
});

function SkeletonCard() {
  return (
    <Card className="p-5 border-0 shadow-sm space-y-3">
      <div className="flex justify-between"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-20" /></div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-36" />
      <div className="flex gap-1 mt-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />)}
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Events() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const canImpersonate = user && ALLOWED_IMPERSONATE.has(user.role);

  // ── filters ──────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom]     = useState(todayStr());
  const [dateTo, setDateTo]         = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [cityFilter, setCity]       = useState("all");
  const [djFilter, setDj]           = useState("any");    // any | unassigned
  const [completionFilter, setCompletion] = useState({}); // { planning_complete: true/false } etc.
  const [readinessFilter, setReadiness]   = useState("any"); // any | lt60 | lt80 | gte80
  const [activeView, setActiveView] = useState("all_upcoming");
  const [clientFilters, setClientFilters] = useState({});  // from saved views

  // ── search ───────────────────────────────────────────────────────────────
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const debounceTimer = useRef(null);
  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(val), 300);
  }, []);

  // ── pagination ───────────────────────────────────────────────────────────
  const [skip, setSkip] = useState(0);
  const [accumulated, setAccumulated] = useState([]);

  // Build server-side filters object for the query key + payload
  const serverFilters = useMemo(() => {
    const f = {};
    if (statusFilter !== "all") f.status = statusFilter;
    if (cityFilter !== "all")   f.city = cityFilter;
    if (djFilter === "unassigned") f.assigned_dj_id = "__unassigned__";
    return f;
  }, [statusFilter, cityFilter, djFilter]);

  // Reset pagination whenever server filters or dates change
  const filterKey = JSON.stringify({ serverFilters, dateFrom, dateTo });
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setSkip(0);
      setAccumulated([]);
    }
  }, [filterKey]);

  // ── query ─────────────────────────────────────────────────────────────────
  const { data: rawData, isFetching, isLoading } = useQuery({
    queryKey: ["events-v2", filterKey, skip],
    queryFn: () => EventAPI.list(serverFilters, "event_date", PAGE_SIZE, skip, dateFrom || null, dateTo || null),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  });

  // Normalize the latest page of results
  const latestRows = useMemo(() => {
    if (!rawData) return [];
    return Array.isArray(rawData) ? rawData : (rawData?.events ?? []);
  }, [rawData]);

  const serverTotal = rawData?.total ?? null;

  // Accumulate pages — re-runs whenever latestRows or skip changes
  useEffect(() => {
    if (latestRows.length === 0 && skip === 0) {
      setAccumulated([]);
      return;
    }
    if (skip === 0) {
      setAccumulated(latestRows);
    } else {
      setAccumulated(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const newRows = latestRows.filter(r => !existingIds.has(r.id));
        return newRows.length ? [...prev, ...newRows] : prev;
      });
    }
  }, [latestRows, skip]);

  const hasMore = latestRows.length === PAGE_SIZE;

  // ── client-side filters ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = accumulated;

    // Completion toggles (user manually set via checkboxes)
    for (const [key, val] of Object.entries(completionFilter)) {
      if (val === "complete")   list = list.filter(e => e[key] === true);
      if (val === "incomplete") list = list.filter(e => !e[key]);
    }

    // Saved-view client filters (incomplete_flags = any of these must be false)
    if (clientFilters.incomplete_flags?.length) {
      list = list.filter(e => clientFilters.incomplete_flags.some(f => !e[f]));
    }

    // Readiness band
    if (readinessFilter === "lt60")  list = list.filter(e => (e.readiness_score || 0) < 60);
    if (readinessFilter === "lt80")  list = list.filter(e => (e.readiness_score || 0) < 80);
    if (readinessFilter === "gte80") list = list.filter(e => (e.readiness_score || 0) >= 80);

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(e =>
        e.event_name?.toLowerCase().includes(q) ||
        e.contact_name?.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [accumulated, completionFilter, clientFilters, readinessFilter, debouncedSearch]);

  // ── saved views ───────────────────────────────────────────────────────────
  const applyView = (viewValue) => {
    const view = SAVED_VIEWS.find(v => v.value === viewValue);
    if (!view) return;
    setActiveView(viewValue);
    // Apply server filters from view
    setStatus(view.filters.status || "all");
    setCity(view.filters.city || "all");
    setDj(view.filters.assigned_dj_id === "__unassigned__" ? "unassigned" : "any");
    // Apply client filters from view
    setClientFilters(view.clientFilters || {});
    setCompletion({});
    setSkip(0);
    setAccumulated([]);
  };

  const clearFilters = () => {
    setDateFrom(todayStr());
    setDateTo("");
    setStatus("all");
    setCity("all");
    setDj("any");
    setCompletion({});
    setClientFilters({});
    setReadiness("any");
    setSearch("");
    setDebounced("");
    setActiveView("all_upcoming");
    setSkip(0);
    setAccumulated([]);
  };

  const hasActiveFilters = statusFilter !== "all" || cityFilter !== "all" || djFilter !== "any"
    || dateTo !== "" || Object.keys(completionFilter).length > 0 || debouncedSearch
    || readinessFilter !== "any" || Object.keys(clientFilters).length > 0;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Events</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {serverTotal !== null ? `${serverTotal} upcoming` : accumulated.length + " loaded"}
            {filtered.length !== accumulated.length ? ` · ${filtered.length} shown` : ""}
          </p>
          {/* DEBUG — remove after verification */}
          <p className="text-[10px] text-gray-300 font-mono">
            Total: {serverTotal ?? "?"} · Rows: {accumulated.length} · Visible: {filtered.length}
          </p>
        </div>
        <Link to={createPageUrl("EventForm")}>
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
            <Plus className="w-4 h-4 mr-1.5" /> New Event
          </Button>
        </Link>
      </div>

      {/* Saved Views */}
      <div className="flex flex-wrap gap-1.5">
        {SAVED_VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => applyView(v.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              activeView === v.value
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-white"
            />
          </div>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-8 rounded-md border border-input px-2 text-sm bg-white text-gray-700"
            title="Start date"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-8 rounded-md border border-input px-2 text-sm bg-white text-gray-700"
            title="End date (optional)"
          />

          {/* Status */}
          <Select value={statusFilter} onValueChange={v => { setStatus(v); setActiveView(""); }}>
            <SelectTrigger className="w-44 h-8 text-sm bg-white"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* City */}
          <Select value={cityFilter} onValueChange={v => { setCity(v); setActiveView(""); }}>
            <SelectTrigger className="w-36 h-8 text-sm bg-white"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* DJ Assignment */}
          <Select value={djFilter} onValueChange={v => { setDj(v); setActiveView(""); }}>
            <SelectTrigger className="w-40 h-8 text-sm bg-white"><SelectValue placeholder="Any DJ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any DJ</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>

          {/* Readiness */}
          <Select value={readinessFilter} onValueChange={setReadiness}>
            <SelectTrigger className="w-36 h-8 text-sm bg-white"><SelectValue placeholder="Any Readiness" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Readiness</SelectItem>
              <SelectItem value="gte80">≥ 80%</SelectItem>
              <SelectItem value="lt80">&lt; 80%</SelectItem>
              <SelectItem value="lt60">&lt; 60%</SelectItem>
            </SelectContent>
          </Select>

          {/* Completion popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-sm gap-1">
                <Filter className="w-3.5 h-3.5" />
                Completion
                {Object.keys(completionFilter).length > 0 && (
                  <Badge className="ml-1 h-4 px-1 text-[10px] bg-violet-600">{Object.keys(completionFilter).length}</Badge>
                )}
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Completion filters</p>
              {COMPLETION_FLAGS.map(f => (
                <div key={f.key} className="flex items-center justify-between">
                  <span className="text-xs text-gray-700">{f.label}</span>
                  <Select
                    value={completionFilter[f.key] || "any"}
                    onValueChange={v => {
                      if (v === "any") {
                        const { [f.key]: _, ...rest } = completionFilter;
                        setCompletion(rest);
                      } else {
                        setCompletion(prev => ({ ...prev, [f.key]: v }));
                      }
                    }}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-400 gap-1" onClick={clearFilters}>
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map(event => (
              <EventCard key={event.id} event={event} canImpersonate={canImpersonate} />
            ))
        }
        {!isLoading && accumulated.length === 0 && serverTotal === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400 text-sm">No upcoming events.</div>
        )}
        {!isLoading && accumulated.length > 0 && filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 text-sm">
            <p>No events match your filters.</p>
            <Button variant="ghost" size="sm" className="mt-2 text-violet-600" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline" size="sm"
            onClick={() => setSkip(s => s + PAGE_SIZE)}
            disabled={isFetching}
          >
            {isFetching ? "Loading…" : `Load more (${accumulated.length}/${serverTotal ?? "?"})`}
          </Button>
        </div>
      )}
    </div>
  );
}