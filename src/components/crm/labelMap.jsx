/**
 * LabelMap utility — canonical key → user-facing label resolution.
 *
 * Usage:
 *   import { useLabels, getLabel, LEAD_STATUSES, EVENT_STATUSES, CITIES } from '@/components/crm/labelMap';
 *
 *   // In a component (live DB labels):
 *   const { label } = useLabels();
 *   label('TUL', 'city')  // → "Tulsa"
 *
 *   // Fallback (no hook needed):
 *   getLabel('booked', 'event_status')  // → "Booked"
 */

import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// ── Hardcoded fallback map (used when DB labels not loaded yet) ──────────────
export const FALLBACK_LABELS = {
  lead_status: {
    web_lead: "Web Lead",
    email_only: "Email Only Lead",
    bridal_show_lead: "Bridal Show Lead",
    corporate_lead: "Corporate Lead",
    hot_lead: "Hot Lead",
    appointment_set: "Appointment Set",
    missed_appointment: "Missed Appointment",
    x_dated: "X Dated",
    never_booked: "Never Booked",
    lost_sale: "Lost Sale",
    booked_pending: "Booked - Pending",
  },
  event_status: {
    booked_pending: "Booked - Pending",
    booked: "Booked",
    planning_in_progress: "Planning In Progress",
    finalized: "Finalized",
    completed: "Completed",
    cancelled: "Cancelled",
    postponed: "Postponed",
  },
  city: {
    TUL: "Tulsa", DFW: "DFW", HOU: "Houston", SAT: "San Antonio",
    KC: "Kansas City", STL: "St. Louis", INDY: "Indianapolis",
    NASH: "Nashville", DEN: "Denver", ATL: "Atlanta",
  },
  lead_flag: {
    contract_overdue: "Contract Overdue",
    do_not_call: "DO NOT CALL",
  },
  calendar_type: {
    bridal_show: "Bridal Show", training: "Training",
  },
  shift_type: {
    runner_shift: "Runner Shift", warehouse_shift: "Warehouse Shift", office_shift: "Office Shift",
  },
};

/** Pure fallback lookup — no hook, safe anywhere */
export function getLabel(key, category) {
  if (!key) return key || "";
  return FALLBACK_LABELS[category]?.[key] ?? key.replace(/_/g, " ");
}

// ── Canonical enum arrays for form dropdowns ──────────────────────────────────
export const LEAD_STATUSES = Object.keys(FALLBACK_LABELS.lead_status);
export const EVENT_STATUSES = Object.keys(FALLBACK_LABELS.event_status);
export const CITIES = Object.keys(FALLBACK_LABELS.city);

/** Computed display string for an event: "Booked - Tulsa" */
export function eventDisplayString(status, city) {
  const s = getLabel(status, "event_status");
  const c = city ? getLabel(city, "city") : null;
  return c ? `${s} - ${c}` : s;
}

// ── Hook: live labels from DB with fallback ───────────────────────────────────
export function useLabels() {
  const { data: records = [] } = useQuery({
    queryKey: ["label_map"],
    queryFn: () => base44.entities.LabelMap.list("sort_order", 200),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // Build lookup from DB records
  const dbMap = {};
  for (const r of records) {
    if (!dbMap[r.category]) dbMap[r.category] = {};
    dbMap[r.category][r.key] = r.label;
  }

  /** label(key, category) — DB first, fallback second */
  function label(key, category) {
    if (!key) return "";
    return dbMap[category]?.[key] ?? getLabel(key, category);
  }

  /** All active entries for a category (sorted) */
  function optionsFor(category) {
    const dbEntries = records.filter(r => r.category === category && r.is_active !== false);
    if (dbEntries.length > 0) {
      return dbEntries.map(r => ({ key: r.key, label: r.label }));
    }
    // Fallback to hardcoded
    const fb = FALLBACK_LABELS[category] || {};
    return Object.entries(fb).map(([key, lbl]) => ({ key, label: lbl }));
  }

  return { label, optionsFor, records };
}