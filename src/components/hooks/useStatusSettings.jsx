/**
 * useStatusSettings — loads EventStatus + StatusGroup from backend.
 * Provides helpers: statusColor(key), statusLabel(key), statusOptions (for dropdowns).
 * Falls back to hardcoded defaults if settings are unavailable.
 */
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Hardcoded fallback — mirrors seeded defaults
export const FALLBACK_STATUS_MAP = {
  booked_pending:       { label: "Booked Pending",       color: "bg-sky-50 text-sky-700 border-sky-200" },
  booked:               { label: "Booked",               color: "bg-blue-50 text-blue-700 border-blue-200" },
  planning_in_progress: { label: "Planning In Progress", color: "bg-violet-50 text-violet-700 border-violet-200" },
  finalized:            { label: "Finalized",            color: "bg-purple-50 text-purple-700 border-purple-200" },
  completed:            { label: "Completed",            color: "bg-green-50 text-green-700 border-green-200" },
  cancelled:            { label: "Cancelled",            color: "bg-red-50 text-red-700 border-red-200" },
  postponed:            { label: "Postponed",            color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function useStatusSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["status-settings-shared"],
    queryFn: () => base44.functions.invoke("getStatusSettings", {}),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const allStatuses = data?.data?.all_statuses || [];
  const activeStatuses = data?.data?.statuses || [];
  const groups = data?.data?.groups || [];

  // Build lookup maps
  const colorMap = {};
  const labelMap = {};
  for (const s of allStatuses) {
    colorMap[s.key] = s.color || FALLBACK_STATUS_MAP[s.key]?.color || "";
    labelMap[s.key] = s.label || FALLBACK_STATUS_MAP[s.key]?.label || s.key.replace(/_/g, " ");
  }

  // If settings not loaded yet, fall back to hardcoded
  function statusColor(key) {
    if (!key) return "";
    return colorMap[key] ?? FALLBACK_STATUS_MAP[key]?.color ?? "";
  }

  function statusLabel(key) {
    if (!key) return "";
    return labelMap[key] ?? FALLBACK_STATUS_MAP[key]?.label ?? key.replace(/_/g, " ");
  }

  // Active status options for dropdowns: [{key, label}]
  const statusOptions = activeStatuses.length > 0
    ? activeStatuses.map(s => ({ key: s.key, label: s.label }))
    : Object.entries(FALLBACK_STATUS_MAP).map(([key, v]) => ({ key, label: v.label }));

  // Group lookup — scoped to entity_key="event" (supports legacy records with no entity_key)
  function getGroupStatuses(groupKey, entityKey = "event") {
    const g = groups.find(g =>
      g.key === groupKey && (g.entity_key === entityKey || (!g.entity_key && entityKey === "event"))
    );
    return g?.statuses?.length > 0 ? g.statuses : null;
  }

  // Event groups only (for UI/dropdowns)
  const eventGroups = groups.filter(g => (g.entity_key || "event") === "event");

  return { statusColor, statusLabel, statusOptions, groups, eventGroups, isLoading, getGroupStatuses };
}