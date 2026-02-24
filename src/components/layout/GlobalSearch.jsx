import React, { useState, useRef, useEffect, useCallback } from "react";
import { SearchAPI } from "../api/secureApi";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Users, CalendarDays, UserCircle, Building2, Music2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";

const ENTITY_META = {
  leads:    { label: "Leads",    icon: Users,       page: "LeadDetail",   color: "text-violet-600" },
  events:   { label: "Events",   icon: CalendarDays, page: "EventDetail",  color: "text-emerald-600" },
  contacts: { label: "Contacts", icon: UserCircle,  page: "ContactDetail", color: "text-blue-600" },
  venues:   { label: "Venues",   icon: Building2,   page: "Venues",        color: "text-amber-600" },
  djs:      { label: "DJs",      icon: Music2,      page: "DJDetail",      color: "text-pink-600" },
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => SearchAPI.search(debouncedQuery, 5),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 15000,
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasResults = results && Object.values(results).some(arr => arr?.length > 0);
  const showDropdown = open && debouncedQuery.trim().length >= 2;

  const handleSelect = () => { setOpen(false); setQuery(""); };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
      <Input
        placeholder="Search leads, events, contacts..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="pl-9 h-9 bg-gray-50/80 border-gray-200 text-sm"
      />
      {isFetching && query.length >= 2 && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gray-400" />
      )}

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden max-h-[420px] overflow-y-auto">
          {!hasResults && !isFetching && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No results for "{debouncedQuery}"</div>
          )}
          {hasResults && Object.entries(ENTITY_META).map(([key, meta]) => {
            const items = results[key] || [];
            if (!items.length) return null;
            const Icon = meta.icon;
            return (
              <div key={key}>
                <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                  <Icon className={`w-3 h-3 ${meta.color}`} />
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{meta.label}</span>
                </div>
                {items.map(item => {
                  const href = (key === "venues" || key === "djs")
                    ? createPageUrl(meta.page) + (key === "djs" ? `?id=${item.id}` : "")
                    : createPageUrl(meta.page) + `?id=${item.id}`;
                  return (
                    <Link key={item.id} to={href} onClick={handleSelect} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 truncate">{item.title}</div>
                        {item.subtitle && <div className="text-xs text-gray-400 truncate mt-0.5">{item.subtitle}</div>}
                      </div>
                      {item.status && (
                        <Badge variant="secondary" className="ml-3 text-[10px] capitalize bg-gray-100 text-gray-500 flex-shrink-0">
                          {item.status?.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 text-right">
            Tip: press Esc to close
          </div>
        </div>
      )}
    </div>
  );
}