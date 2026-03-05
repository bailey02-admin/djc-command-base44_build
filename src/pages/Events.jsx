import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStatusSettings } from "@/components/hooks/useStatusSettings";
import { EventAPI, TableViewConfigAPI } from "@/components/api/secureApi";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays, addDays } from "date-fns";
import {
  Plus, Search, X, ExternalLink, Loader2, ChevronDown,
  ChevronUp, ChevronsUpDown, ArrowRight, DollarSign, Columns
} from "lucide-react";
import ColumnCustomizer, { COLUMN_REGISTRY } from "@/components/events/ColumnCustomizer";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
const ALLOWED_IMPERSONATE = new Set(["admin", "city_manager", "office_finalizer"]);
const FINANCE_ROLES = new Set(["admin", "city_manager", "sales_manager", "finance"]);
const todayStr = () => new Date().toISOString().split("T")[0];
const CITY_OPTIONS = ["TUL","DFW","HOU","SAT","KC","STL","INDY","NASH","DEN","ATL"];

const SAVED_VIEWS = [
  { label: "All Upcoming",        value: "all_upcoming",        filters: {},                                clientFilters: {} },
  { label: "Needs DJ",            value: "needs_dj",            filters: { assigned_dj_id: "__unassigned__" }, clientFilters: {} },
  { label: "Incomplete Planning", value: "incomplete_planning", filters: {},                                clientFilters: { incomplete_flags: ["planning_complete","timeline_complete","music_complete"] } },
  { label: "Balance Due",         value: "balance_due",         filters: {},                                clientFilters: { balance_due: true } },
  { label: "Finalization Needed", value: "finalization_needed", filters: {},                                clientFilters: { incomplete_flags: ["final_call_completed","dj_briefed"] } },
  { label: "Cancelled",           value: "cancelled",           filters: { status: "cancelled" },           clientFilters: {} },
  { label: "Completed",           value: "completed",           filters: { status: "completed" },           clientFilters: {} },
];

const DATE_PRESETS = [
  { label: "Next 7d",  days: 7 },
  { label: "Next 30d", days: 30 },
  { label: "Next 90d", days: 90 },
];

// Default columns if no config exists yet
const DJEP_DEFAULT_COLUMNS = [
  { key: "event_date",     label: "Event Date",  visible: true },
  { key: "status_city",    label: "Status",      visible: true },
  { key: "contact_name",   label: "Client",      visible: true },
  { key: "event_name",     label: "Event",       visible: true },
  { key: "venue_name",     label: "Venue",       visible: true },
  { key: "setup_time",     label: "Setup",       visible: true },
  { key: "start_time",     label: "Start",       visible: true },
  { key: "end_time",       label: "End",         visible: true },
  { key: "event_type",     label: "Event Type",  visible: true },
  { key: "assigned_dj",    label: "DJ",          visible: true },
  { key: "total_fee",      label: "Total Fee",   visible: true },
  { key: "balance_due",    label: "Balance Due", visible: true },
  { key: "view_action",    label: "View",        visible: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function ReadinessBar({ score }) {
  const pct = score ?? 0;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5 min-w-[72px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-violet-500" />
    : <ChevronDown className="w-3 h-3 text-violet-500" />;
}

function ViewAsClientBtn({ event }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const handle = async (e) => {
    e.stopPropagation();
    if (!event.contact_id) { setErr("No contact"); return; }
    setLoading(true); setErr(null);
    try {
      const res = await base44.functions.invoke("createImpersonationSession", { event_id: event.id });
      if (res.data?.ok && res.data?.redirect_url) window.open(res.data.redirect_url, "_blank", "noopener,noreferrer");
      else setErr(res.data?.error || "Failed");
    } catch (ex) { setErr(ex?.response?.data?.error || "Error"); }
    finally { setLoading(false); }
  };
  return (
    <button onClick={handle} disabled={loading} title={err || "View as Client"}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors
        ${err ? "border-red-200 text-red-500" : "border-indigo-100 text-indigo-500 hover:border-indigo-300 hover:text-indigo-700"}`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
      {err || "Client"}
    </button>
  );
}

function TableSkeleton({ colCount }) {
  return Array.from({ length: 8 }).map((_, i) => (
    <tr key={i} className="border-b border-gray-100">
      {Array.from({ length: colCount }).map((__, j) => (
        <td key={j} className="px-3 py-3"><Skeleton className="h-3.5 w-full" /></td>
      ))}
    </tr>
  ));
}

// ─── Cell renderer ────────────────────────────────────────────────────────────
function EventCell({ colKey, event, canImpersonate, navigate, statusColor, statusLabel }) {
  switch (colKey) {
    case "event_date": {
      const days = event.event_date ? differenceInDays(new Date(event.event_date), new Date()) : null;
      return (
        <div>
          <div className="text-sm font-medium text-gray-800">
            {event.event_date ? format(new Date(event.event_date), "MMM d, yyyy") : "—"}
          </div>
          {days !== null && (
            <div className={`text-[10px] mt-0.5 ${days === 0 ? "text-red-500 font-bold" : days <= 7 ? "text-red-400" : days <= 30 ? "text-amber-500" : "text-gray-400"}`}>
              {days === 0 ? "Today" : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
            </div>
          )}
        </div>
      );
    }
    case "status_city":
      return (
        <div>
          <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${statusColor(event.status)}`}>
            {statusLabel(event.status) || "—"}
          </Badge>
          {event.city && <div className="text-[10px] text-gray-400 mt-0.5">{event.city}</div>}
        </div>
      );
    case "setup_time":
      return <span className="text-sm text-gray-600">{event.setup_time || "—"}</span>;
    case "contact_name":
      return <span className="text-sm text-gray-700 max-w-[130px] truncate block">{event.contact_name || "—"}</span>;
    case "event_name":
      return (
        <div>
          <div className="font-medium text-gray-900 max-w-[180px] truncate">{event.event_name}</div>
          <div className="text-[10px] text-gray-400 capitalize mt-0.5">{event.event_type?.replace(/_/g, " ")}</div>
        </div>
      );
    case "event_type":
      return <span className="text-sm text-gray-600 capitalize">{event.event_type?.replace(/_/g, " ") || "—"}</span>;
    case "staff_combined":
      return (
        <div className="text-sm max-w-[140px]">
          {event.assigned_dj
            ? <div className="text-gray-700 truncate">{event.assigned_dj}</div>
            : <span className="text-amber-500 text-xs font-medium">Unassigned</span>}
          {event.assigned_mc && <div className="text-[10px] text-gray-400 mt-0.5 truncate">MC: {event.assigned_mc}</div>}
          {event.assigned_finalizer && <div className="text-[10px] text-gray-400 mt-0.5 truncate">FNL: {event.assigned_finalizer}</div>}
        </div>
      );
    case "assigned_dj":
      return <span className="text-sm text-gray-700 truncate block max-w-[120px]">{event.assigned_dj || <span className="text-amber-500 text-xs">Unassigned</span>}</span>;
    case "assigned_mc":
      return <span className="text-sm text-gray-600 truncate block max-w-[120px]">{event.assigned_mc || "—"}</span>;
    case "assigned_finalizer":
      return <span className="text-sm text-gray-600 truncate block max-w-[120px]">{event.assigned_finalizer || "—"}</span>;
    case "venue_name":
      return <span className="text-sm text-gray-600 truncate block max-w-[130px]">{event.venue_name || "—"}</span>;
    case "city":
      return <span className="text-sm text-gray-600">{event.city || "—"}</span>;
    case "setup_time":
      return <span className="text-sm text-gray-600">{event.setup_time || "—"}</span>;
    case "start_time":
      return <span className="text-sm text-gray-600">{event.start_time || "—"}</span>;
    case "end_time":
      return <span className="text-sm text-gray-600">{event.end_time || "—"}</span>;
    case "lead_source":
      return <span className="text-sm text-gray-600 capitalize">{event.lead_source?.replace(/_/g, " ") || "—"}</span>;
    case "package_name":
      return <span className="text-sm text-gray-700">{event.package_name || <span className="text-gray-300 italic text-xs">Not quoted</span>}</span>;
    case "total_fee": {
      const fee = event.total_fee ?? event.package_price ?? null;
      return fee != null
        ? <span className="text-sm text-gray-700">${fee.toLocaleString()}</span>
        : <span className="text-gray-300">—</span>;
    }
    case "balance_due": {
      const bdAmt = event.balance_due_amount;
      if (bdAmt == null) return <span className="text-gray-300">—</span>;
      if (bdAmt === 0) return <span className="text-emerald-600 text-xs">Paid</span>;
      return <span className="text-rose-600 font-semibold text-sm">${bdAmt.toLocaleString()} <span className="text-[10px] block text-rose-400">due</span></span>;
    }
    case "readiness_score":
      return <ReadinessBar score={event.readiness_score ?? 0} />;
    case "organization_name":
      return event.organization_name
        ? <span className="text-sm text-gray-700 truncate max-w-[140px] block">{event.organization_name}</span>
        : <span className="text-gray-300">—</span>;
    case "salesperson_name":
      return event.salesperson_name
        ? <span className="text-sm text-gray-700">{event.salesperson_name}</span>
        : <span className="text-gray-300">—</span>;
    case "inquiry_source_label":
      return event.inquiry_source_label
        ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{event.inquiry_source_label}</span>
        : <span className="text-gray-300">—</span>;
    case "add_ons_summary":
      if (!event.add_ons_count) return <span className="text-gray-300">—</span>;
      return (
        <span className="text-xs text-gray-700 max-w-[180px] block truncate" title={event.add_ons_summary}>
          {event.add_ons_summary || `${event.add_ons_count} add-on${event.add_ons_count !== 1 ? "s" : ""}`}
        </span>
      );
    case "view_action":
      return (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <Link to={createPageUrl("EventDetail") + `?id=${event.id}`} onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1">
              Open <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
          {canImpersonate && event.contact_id && <ViewAsClientBtn event={event} />}
        </div>
      );
    default:
      return <span className="text-gray-300">—</span>;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Events() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const canImpersonate = user && ALLOWED_IMPERSONATE.has(user.role);
  const canSeeFinance  = user && FINANCE_ROLES.has(user.role);

  const { statusColor, statusLabel, statusOptions } = useStatusSettings();

  // ── column config state ───────────────────────────────────────────────────
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [activeConfigId, setActiveConfigId] = useState(null);
  const [activeColumns, setActiveColumns] = useState(DJEP_DEFAULT_COLUMNS);
  const [activeViewName, setActiveViewName] = useState("DJEP Default");

  // Load user's saved configs
  const { data: savedConfigs = [], refetch: refetchConfigs } = useQuery({
    queryKey: ["table-view-configs", "events"],
    queryFn: () => TableViewConfigAPI.list("events"),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Track last save timestamp for debug bar
  const [lastSaveAt, setLastSaveAt] = useState(null);

  // On load: apply user's default or fall back to global default (only once)
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (!savedConfigs.length || defaultApplied.current) return;
    const userDefault = savedConfigs.find(c => !c.is_global && c.is_default);
    const globalDefault = savedConfigs.find(c => c.is_global && c.is_default);
    const toApply = userDefault || globalDefault;
    if (toApply) {
      defaultApplied.current = true;
      setActiveConfigId(toApply.id);
      setActiveViewName(toApply.name);
      setActiveColumns(filterColumnsByRole(toApply.columns || [], user?.role));
    }
  }, [savedConfigs, user]);

  function filterColumnsByRole(cols, role) {
    if (!role) return cols;
    if (FINANCE_ROLES.has(role)) return cols;
    const financeKeys = new Set(
      COLUMN_REGISTRY.filter(r => r.role_min === "finance").map(r => r.key)
    );
    return cols.filter(c => !financeKeys.has(c.key));
  }

  const visibleColumns = useMemo(() =>
    activeColumns.filter(c => c.visible !== false),
    [activeColumns]
  );

  const ADMIN_SAVE_LIMIT = 6;

  const handleSaveConfig = async ({ name, columns, is_default }) => {
    if (user?.role !== "admin") return;

    const sanitized = filterColumnsByRole(columns, user?.role);
    const payload = { entity_key: "events", name, columns: sanitized, is_default };

    // Determine if this is an update (editing an existing saved config)
    const isUpdate = activeConfigId && savedConfigs.find(c => c.id === activeConfigId && !c.is_global);
    if (isUpdate) {
      payload.id = activeConfigId;
    } else {
      // New view — enforce limit
      const userOwnedCount = savedConfigs.filter(c => !c.is_global).length;
      if (userOwnedCount >= ADMIN_SAVE_LIMIT) {
        toast.error(`You can only save up to ${ADMIN_SAVE_LIMIT} column views. Delete one first.`);
        return;
      }
    }
    try {
      // invoke() in secureApi already unwraps r.data — so res = { config, warnings }
      const res = await TableViewConfigAPI.save(payload);
      const saved = res?.config;
      if (!saved || !saved.id) {
        throw new Error(res?.error || "Server returned no config");
      }
      // Update local state immediately — no wait for refetch
      setActiveConfigId(saved.id);
      setActiveViewName(saved.name);
      setActiveColumns(filterColumnsByRole(saved.columns || [], user?.role));
      setLastSaveAt(new Date().toLocaleTimeString());
      // Update cached configs list
      queryClient.setQueryData(["table-view-configs", "events"], (old = []) => {
        const without = old.filter(c => c.id !== saved.id);
        return [...without, saved];
      });
      setCustomizerOpen(false);
      toast.success(`View "${saved.name}" saved`);
      if (res.warnings?.length > 0) {
        res.warnings.forEach(w => toast.warning(`⚠️ ${w}`));
      }
    } catch (err) {
      console.error("[Events handleSaveConfig] failed:", err);
      toast.error(`Save failed: ${err.message}`);
    }
  };

  const handleReset = () => {
    setActiveConfigId(null);
    setActiveViewName("DJEP Default");
    setActiveColumns(canSeeFinance ? DJEP_DEFAULT_COLUMNS : filterColumnsByRole(DJEP_DEFAULT_COLUMNS, user?.role));
    setLastSaveAt(null);
  };

  // ── filters ──────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo]     = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [cityFilter, setCity]     = useState("all");
  const [djFilter, setDj]         = useState("any");
  const [activeSavedView, setActiveSavedView] = useState("all_upcoming");
  const [clientFilters, setClientFilters] = useState({});

  // ── search ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
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
    setSkip(0); setAccumulated([]);
  };

  // ── pagination ───────────────────────────────────────────────────────────
  const [skip, setSkip] = useState(0);
  const [accumulated, setAccumulated] = useState([]);

  const serverFilters = useMemo(() => {
    const f = {};
    if (statusFilter !== "all") f.status = statusFilter;
    if (cityFilter !== "all")   f.city = cityFilter;
    if (djFilter === "unassigned") f.assigned_dj_id = "__unassigned__";
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [statusFilter, cityFilter, djFilter, debouncedSearch]);

  const serverSort = `${sortDir === "desc" ? "-" : ""}${sortCol === "status_city" ? "status" : sortCol === "staff_combined" ? "assigned_dj" : sortCol}`;

  const filterKey = JSON.stringify({ serverFilters, dateFrom, dateTo, serverSort });
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setSkip(0);
      setAccumulated([]);
    }
  }, [filterKey]);

  const { data: rawData, isFetching, isLoading } = useQuery({
    queryKey: ["events-v2", filterKey, skip],
    queryFn: () => EventAPI.list(serverFilters, serverSort, PAGE_SIZE, skip, dateFrom || null, dateTo || null),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
  });

  const latestRows = useMemo(() => rawData?.events ?? [], [rawData]);
  const serverTotal = rawData?.total ?? null;

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

  // ── client-side filters (incomplete flags + balance_due toggle) ───────────
  // Sorting and search are server-driven; only flag filters remain client-side
  const displayed = useMemo(() => {
    let list = accumulated;
    if (clientFilters.incomplete_flags?.length) {
      list = list.filter(e => clientFilters.incomplete_flags.some(f => !e[f]));
    }
    if (clientFilters.balance_due) {
      list = list.filter(e => (e.balance_due_amount ?? (e.balance_paid ? 0 : 1)) > 0);
    }
    return list;
  }, [accumulated, clientFilters]);

  // ── saved views ───────────────────────────────────────────────────────────
  const applyView = (viewValue) => {
    const view = SAVED_VIEWS.find(v => v.value === viewValue);
    if (!view) return;
    setActiveSavedView(viewValue);
    setStatus(view.filters.status || "all");
    setCity(view.filters.city || "all");
    setDj(view.filters.assigned_dj_id === "__unassigned__" ? "unassigned" : "any");
    setClientFilters(view.clientFilters || {});
    setSkip(0); setAccumulated([]);
  };

  const applyDatePreset = (days) => {
    const from = todayStr();
    const to = format(addDays(new Date(), days), "yyyy-MM-dd");
    setDateFrom(from); setDateTo(to);
    setSkip(0); setAccumulated([]);
  };

  const clearFilters = () => {
    setDateFrom(todayStr()); setDateTo(""); setStatus("all"); setCity("all");
    setDj("any"); setClientFilters({}); setSearch(""); setDebounced("");
    setActiveSavedView("all_upcoming"); setSkip(0); setAccumulated([]);
  };

  const hasActiveFilters = statusFilter !== "all" || cityFilter !== "all" || djFilter !== "any"
    || dateTo !== "" || debouncedSearch || Object.keys(clientFilters).length > 0;

  const thCls = `px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap`;
  const thSortCls = thCls + " cursor-pointer select-none hover:text-gray-800";

  const SORTABLE_KEYS = new Set(["event_date","event_name","city","status","contact_name","assigned_dj","readiness_score","total_fee","setup_time","start_time","end_time","venue_name"]);
  const SORT_KEY_MAP = { "status_city": "status", "staff_combined": "assigned_dj" };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">

      {/* Header */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
         <div>
           <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Events</h1>
           <p className="text-sm text-gray-400 mt-0.5">
             {serverTotal !== null ? `${serverTotal} total` : `${accumulated.length} loaded`}
             {displayed.length !== accumulated.length ? ` · ${displayed.length} shown` : ""}
           </p>
           <p className="text-xs text-gray-500 mt-1">DEBUG: Active columns: {visibleColumns.map(c => c.key).join(", ") || "none"}</p>
         </div>
        <div className="flex items-center gap-2">
          {/* View selector */}
          {savedConfigs.length > 1 && (
            <Select value={activeConfigId || "__default__"} onValueChange={id => {
              if (id === "__default__") { handleReset(); return; }
              const cfg = savedConfigs.find(c => c.id === id);
              if (cfg) {
                setActiveConfigId(cfg.id);
                setActiveViewName(cfg.name);
                setActiveColumns(filterColumnsByRole(cfg.columns || [], user?.role));
              }
            }}>
              <SelectTrigger className="h-9 text-sm w-40">
                <SelectValue placeholder={activeViewName} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">DJEP Default</SelectItem>
                {savedConfigs.filter(c => !c.is_global).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm" onClick={() => setCustomizerOpen(true)}>
            <Columns className="w-4 h-4" /> Columns
          </Button>
          <Link to={createPageUrl("EventForm")}>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-sm h-9">
              <Plus className="w-4 h-4 mr-1.5" /> New Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Saved Views */}
      <div className="flex flex-wrap gap-1.5">
        {SAVED_VIEWS.map(v => (
          <button key={v.value} onClick={() => applyView(v.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              activeSavedView === v.value
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700"
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input placeholder="Search events…" value={search} onChange={e => handleSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          <div className="flex gap-1">
            {DATE_PRESETS.map(p => (
              <button key={p.days} onClick={() => applyDatePreset(p.days)}
                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-700 transition-colors bg-white">
                {p.label}
              </button>
            ))}
          </div>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setSkip(0); setAccumulated([]); }}
            className="h-8 rounded-md border border-input px-2 text-sm bg-white text-gray-700" title="From" />
          <span className="text-gray-400 text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setSkip(0); setAccumulated([]); }}
            className="h-8 rounded-md border border-input px-2 text-sm bg-white text-gray-700" title="To" />
          <Select value={statusFilter} onValueChange={v => { setStatus(v); setActiveSavedView(""); }}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={v => { setCity(v); setActiveSavedView(""); }}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="All Cities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={djFilter} onValueChange={v => { setDj(v); setActiveSavedView(""); }}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Any DJ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any DJ</SelectItem>
              <SelectItem value="unassigned">Unassigned DJ</SelectItem>
            </SelectContent>
          </Select>
          {canSeeFinance && (
            <button
              onClick={() => setClientFilters(f => f.balance_due ? {} : { ...f, balance_due: true })}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                clientFilters.balance_due
                  ? "bg-rose-50 text-rose-700 border-rose-300"
                  : "bg-white text-gray-600 border-gray-200 hover:border-rose-300"
              }`}>
              <DollarSign className="w-3 h-3" /> Balance Due
            </button>
          )}
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
                {visibleColumns.map(col => {
                  const sortKey = SORT_KEY_MAP[col.key] || col.key;
                  const isSortable = SORTABLE_KEYS.has(sortKey);
                  return (
                    <th key={col.key}
                      className={isSortable ? thSortCls : thCls}
                      onClick={isSortable ? () => handleSort(sortKey) : undefined}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {isSortable && <SortIcon col={sortKey} sortCol={sortCol} sortDir={sortDir} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton colCount={visibleColumns.length} />
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-16 text-gray-400 text-sm">
                    {accumulated.length === 0 ? "No upcoming events." : "No events match your filters."}
                    {accumulated.length > 0 && (
                      <div className="mt-2">
                        <Button variant="ghost" size="sm" className="text-violet-600" onClick={clearFilters}>Clear filters</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : displayed.map(event => (
                <tr key={event.id}
                  onClick={() => navigate(createPageUrl("EventDetail") + `?id=${event.id}`)}
                  className="border-b border-gray-50 hover:bg-violet-50/40 cursor-pointer transition-colors">
                  {visibleColumns.map(col => (
                    <td key={col.key} className="px-3 py-3">
                      <EventCell colKey={col.key} event={event} canImpersonate={canImpersonate} navigate={navigate} statusColor={statusColor} statusLabel={statusLabel} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && hasMore && (
          <div className="flex justify-center py-4 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => setSkip(s => s + PAGE_SIZE)} disabled={isFetching}>
              {isFetching ? "Loading…" : `Load more (${accumulated.length}${serverTotal ? `/${serverTotal}` : ""})`}
            </Button>
          </div>
        )}
      </div>

      {/* Column Customizer panel */}
      <ColumnCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        columns={activeColumns}
        userRole={user?.role}
        onSave={handleSaveConfig}
        onReset={handleReset}
        viewName={activeViewName}
        onViewNameChange={setActiveViewName}
      />
    </div>
  );
}