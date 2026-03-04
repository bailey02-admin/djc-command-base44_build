import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { EventAPI } from "../components/api/secureApi";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInDays } from "date-fns";
import {
  Plus, Search, Filter, X, ExternalLink, Loader2, ChevronDown,
  ChevronUp, ChevronsUpDown, ArrowRight
} from "lucide-react";

// ─── constants ────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const PAGE_SIZE = 50;
const ALLOWED_IMPERSONATE = new Set(["admin", "city_manager", "office_finalizer"]);

const STATUS_OPTIONS = [
  { value: "booked_pending",       label: "Booked Pending",       color: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "booked",               label: "Booked",               color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "planning_in_progress", label: "Planning In Progress", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { value: "finalized",            label: "Finalized",            color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "completed",            label: "Completed",            color: "bg-green-50 text-green-700 border-green-200" },
  { value: "cancelled",            label: "Cancelled",            color: "bg-red-50 text-red-700 border-red-200" },
  { value: "postponed",            label: "Postponed",            color: "bg-amber-50 text-amber-700 border-amber-200" },
];
const STATUS_COLOR = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.color]));
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s.label]));

const CITY_OPTIONS = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];

const COMPLETION_FLAGS = [
  { key: "planning_complete",    label: "Planning" },
  { key: "timeline_complete",    label: "Timeline" },
  { key: "music_complete",       label: "Music" },
  { key: "contract_signed",      label: "Contract" },
  { key: "deposit_paid",         label: "Deposit" },
  { key: "balance_paid",         label: "Balance" },
  { key: "final_call_completed", label: "Final Call" },
  { key: "dj_briefed",           label: "DJ Briefed" },
];

const SAVED_VIEWS = [
  { label: "All Upcoming",        value: "all_upcoming",        filters: {},                                clientFilters: {} },
  { label: "Needs DJ Assigned",   value: "needs_dj",            filters: { assigned_dj_id: "__unassigned__" }, clientFilters: {} },
  { label: "Incomplete Planning", value: "incomplete_planning", filters: {},                                clientFilters: { incomplete_flags: ["planning_complete","timeline_complete","music_complete"] } },
  { label: "Payment Issues",      value: "payment_issues",      filters: {},                                clientFilters: { incomplete_flags: ["deposit_paid","balance_paid"] } },
  { label: "Finalization Needed", value: "finalization_needed", filters: {},                                clientFilters: { incomplete_flags: ["final_call_completed","dj_briefed"] } },
  { label: "Cancelled",           value: "cancelled",           filters: { status: "cancelled" },           clientFilters: {} },
  { label: "Completed",           value: "completed",           filters: { status: "completed" },           clientFilters: {} },
];

// ─── Readiness bar ────────────────────────────────────────────────────────────
function ReadinessBar({ score }) {
  const pct = score ?? 0;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-violet-500" />
    : <ChevronDown className="w-3 h-3 text-violet-500" />;
}

// ─── ViewAsClient button ──────────────────────────────────────────────────────
function ViewAsClientBtn({ event }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const handle = async (e) => {
    e.stopPropagation();
    if (!event.contact_id) { setErr("No contact"); return; }
    setLoading(true); setErr(null);
    try {
      const res = await base44.functions.invoke("createImpersonationSession", { event_id: event.id });
      if (res.data?.ok && res.data?.redirect_url) {
        window.open(res.data.redirect_url, "_blank", "noopener,noreferrer");
      } else {
        setErr(res.data?.error || "Failed");
      }
    } catch (ex) {
      setErr(ex?.response?.data?.error || "Error");
    } finally { setLoading(false); }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      title={err || "View as Client"}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors
        ${err ? "border-red-200 text-red-500" : "border-indigo-100 text-indigo-500 hover:border-indigo-300 hover:text-indigo-700"}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
      {err || "Client"}
    </button>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────
function TableSkeleton() {
  return Array.from({ length: 8 }).map((_, i) => (
    <tr key={i} className="border-b border-gray-100">
      {Array.from({ length: 8 }).map((__, j) => (
        <td key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-full" /></td>
      ))}
    </tr>
  ));
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Events() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const canImpersonate = user && ALLOWED_IMPERSONATE.has(user.role);

  // ── filters ──────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom]           = useState(todayStr());
  const [dateTo, setDateTo]               = useState("");
  const [statusFilter, setStatus]         = useState("all");
  const [cityFilter, setCity]             = useState("all");
  const [djFilter, setDj]                 = useState("any");
  const [completionFilter, setCompletion] = useState({});
  const [readinessFilter, setReadiness]   = useState("any");
  const [activeView, setActiveView]       = useState("all_upcoming");
  const [clientFilters, setClientFilters] = useState({});

  // ── search ───────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const debounceTimer = useRef(null);
  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(val), 300);
  }, []);

  // ── sort ─────────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState("event_date");
  const [sortDir, setSortDir] = useState("asc");
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  // ── pagination ───────────────────────────────────────────────────────────
  const [skip, setSkip]               = useState(0);
  const [accumulated, setAccumulated] = useState([]);

  const serverFilters = useMemo(() => {
    const f = {};
    if (statusFilter !== "all")        f.status = statusFilter;
    if (cityFilter !== "all")          f.city = cityFilter;
    if (djFilter === "unassigned")     f.assigned_dj_id = "__unassigned__";
    return f;
  }, [statusFilter, cityFilter, djFilter]);

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

  const latestRows = useMemo(() => {
    if (!rawData) return [];
    return Array.isArray(rawData) ? rawData : (rawData?.events ?? []);
  }, [rawData]);

  const serverTotal = Array.isArray(rawData) ? null : (rawData?.total ?? null);

  useEffect(() => {
    if (skip === 0) {
      setAccumulated(latestRows);
    } else if (latestRows.length > 0) {
      setAccumulated(prev => {
        const ids = new Set(prev.map(e => e.id));
        const next = latestRows.filter(r => !ids.has(r.id));
        return next.length ? [...prev, ...next] : prev;
      });
    }
  }, [latestRows, skip]);

  const hasMore = latestRows.length === PAGE_SIZE;

  // ── client-side filters + sort ────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = accumulated;

    for (const [key, val] of Object.entries(completionFilter)) {
      if (val === "complete")   list = list.filter(e => e[key] === true);
      if (val === "incomplete") list = list.filter(e => !e[key]);
    }
    if (clientFilters.incomplete_flags?.length) {
      list = list.filter(e => clientFilters.incomplete_flags.some(f => !e[f]));
    }
    if (readinessFilter === "lt60")  list = list.filter(e => (e.readiness_score || 0) < 60);
    if (readinessFilter === "lt80")  list = list.filter(e => (e.readiness_score || 0) < 80);
    if (readinessFilter === "gte80") list = list.filter(e => (e.readiness_score || 0) >= 80);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(e =>
        e.event_name?.toLowerCase().includes(q) ||
        e.contact_name?.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q) ||
        e.assigned_dj?.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case "event_date":    av = a.event_date || ""; bv = b.event_date || ""; break;
        case "event_name":    av = a.event_name || ""; bv = b.event_name || ""; break;
        case "city":          av = a.city || ""; bv = b.city || ""; break;
        case "status":        av = a.status || ""; bv = b.status || ""; break;
        case "contact_name":  av = a.contact_name || ""; bv = b.contact_name || ""; break;
        case "assigned_dj":   av = a.assigned_dj || ""; bv = b.assigned_dj || ""; break;
        case "readiness":     av = a.readiness_score || 0; bv = b.readiness_score || 0; break;
        default:              av = ""; bv = "";
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [accumulated, completionFilter, clientFilters, readinessFilter, debouncedSearch, sortCol, sortDir]);

  // ── saved views ───────────────────────────────────────────────────────────
  const applyView = (viewValue) => {
    const view = SAVED_VIEWS.find(v => v.value === viewValue);
    if (!view) return;
    setActiveView(viewValue);
    setStatus(view.filters.status || "all");
    setCity(view.filters.city || "all");
    setDj(view.filters.assigned_dj_id === "__unassigned__" ? "unassigned" : "any");
    setClientFilters(view.clientFilters || {});
    setCompletion({});
    setSkip(0);
    setAccumulated([]);
  };

  const clearFilters = () => {
    setDateFrom(todayStr()); setDateTo(""); setStatus("all"); setCity("all");
    setDj("any"); setCompletion({}); setClientFilters({}); setReadiness("any");
    setSearch(""); setDebounced(""); setActiveView("all_upcoming");
    setSkip(0); setAccumulated([]);
  };

  const hasActiveFilters = statusFilter !== "all" || cityFilter !== "all" || djFilter !== "any"
    || dateTo !== "" || Object.keys(completionFilter).length > 0 || debouncedSearch
    || readinessFilter !== "any" || Object.keys(clientFilters).length > 0;

  const thCls = (col) =>
    `px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 whitespace-nowrap`;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 lg:p-8 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Events</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {serverTotal !== null ? `${serverTotal} total` : `${accumulated.length} loaded`}
            {displayed.length !== accumulated.length ? ` · ${displayed.length} shown` : ""}
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
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input placeholder="Search…" value={search} onChange={e => handleSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>

          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 rounded-md border border-input px-2 text-sm bg-white text-gray-700" title="From" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 rounded-md border border-input px-2 text-sm bg-white text-gray-700" title="To (optional)" />

          <Select value={statusFilter} onValueChange={v => { setStatus(v); setActiveView(""); }}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={cityFilter} onValueChange={v => { setCity(v); setActiveView(""); }}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={djFilter} onValueChange={v => { setDj(v); setActiveView(""); }}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Any DJ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any DJ</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>

          <Select value={readinessFilter} onValueChange={setReadiness}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Any Readiness" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Readiness</SelectItem>
              <SelectItem value="gte80">≥ 80%</SelectItem>
              <SelectItem value="lt80">&lt; 80%</SelectItem>
              <SelectItem value="lt60">&lt; 60%</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-sm gap-1">
                <Filter className="w-3.5 h-3.5" /> Completion
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
                      if (v === "any") { const { [f.key]: _, ...rest } = completionFilter; setCompletion(rest); }
                      else setCompletion(prev => ({ ...prev, [f.key]: v }));
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[
                  { col: "event_date",   label: "Date" },
                  { col: "event_name",   label: "Event" },
                  { col: "city",         label: "City" },
                  { col: "status",       label: "Status" },
                  { col: "contact_name", label: "Contact" },
                  { col: "assigned_dj",  label: "DJ" },
                  { col: "readiness",    label: "Readiness" },
                ].map(({ col, label }) => (
                  <th key={col} className={thCls(col)} onClick={() => handleSort(col)}>
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton />
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                    {accumulated.length === 0 ? "No upcoming events." : "No events match your filters."}
                    {accumulated.length > 0 && (
                      <div className="mt-2">
                        <Button variant="ghost" size="sm" className="text-violet-600" onClick={clearFilters}>Clear filters</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : displayed.map(event => {
                const days = event.event_date ? differenceInDays(new Date(event.event_date), new Date()) : null;
                return (
                  <tr
                    key={event.id}
                    onClick={() => navigate(createPageUrl("EventDetail") + `?id=${event.id}`)}
                    className="border-b border-gray-50 hover:bg-violet-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-800">
                        {event.event_date ? format(new Date(event.event_date), "MMM d, yyyy") : "—"}
                      </div>
                      {days !== null && (
                        <div className={`text-[10px] mt-0.5 ${days === 0 ? "text-red-500 font-bold" : days <= 7 ? "text-red-400" : days <= 30 ? "text-amber-500" : "text-gray-400"}`}>
                          {days === 0 ? "Today" : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 max-w-[200px] truncate">{event.event_name}</div>
                      <div className="text-[10px] text-gray-400 capitalize mt-0.5">{event.event_type?.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{event.city || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${STATUS_COLOR[event.status] || ""}`}>
                        {STATUS_LABEL[event.status] || event.status?.replace(/_/g, " ") || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate">{event.contact_name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">{event.assigned_dj || <span className="text-amber-500 text-xs">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      <ReadinessBar score={event.readiness_score ?? 0} />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Link to={createPageUrl("EventDetail") + `?id=${event.id}`} onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1">
                            Open <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                        {canImpersonate && event.contact_id && <ViewAsClientBtn event={event} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {!isLoading && hasMore && (
          <div className="flex justify-center py-4 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => setSkip(s => s + PAGE_SIZE)} disabled={isFetching}>
              {isFetching ? "Loading…" : `Load more (${accumulated.length}${serverTotal ? `/${serverTotal}` : ""})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}