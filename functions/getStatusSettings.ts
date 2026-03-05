/**
 * getStatusSettings — returns all EventStatus + StatusGroup records.
 * On first load (no statuses exist), seeds defaults so the system always has a working config.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_STATUSES = [
  { key: "booked_pending",       label: "Booked Pending",       color: "bg-sky-50 text-sky-700 border-sky-200",       sort_order: 0,  is_active: true },
  { key: "booked",               label: "Booked",               color: "bg-blue-50 text-blue-700 border-blue-200",     sort_order: 10, is_active: true },
  { key: "planning_in_progress", label: "Planning In Progress", color: "bg-violet-50 text-violet-700 border-violet-200", sort_order: 20, is_active: true },
  { key: "finalized",            label: "Finalized",            color: "bg-purple-50 text-purple-700 border-purple-200", sort_order: 30, is_active: true },
  { key: "completed",            label: "Completed",            color: "bg-green-50 text-green-700 border-green-200",  sort_order: 40, is_active: true },
  { key: "cancelled",            label: "Cancelled",            color: "bg-red-50 text-red-700 border-red-200",        sort_order: 50, is_active: true },
  { key: "postponed",            label: "Postponed",            color: "bg-amber-50 text-amber-700 border-amber-200",  sort_order: 60, is_active: true },
];

const DEFAULT_GROUPS = [
  {
    key: "official_booked",
    label: "Official Booked Statuses",
    description: "Events in these statuses are considered officially booked — triggers quote snapshot and payment schedule creation.",
    statuses: ["booked_pending", "booked", "planning_in_progress", "finalized"],
    required: true,
  },
  {
    key: "finalized",
    label: "Finalized Statuses",
    description: "Events in these statuses have completed all planning steps.",
    statuses: ["finalized"],
    required: false,
  },
  {
    key: "active",
    label: "Active Statuses",
    description: "All statuses that represent an active (non-terminal) event.",
    statuses: ["booked_pending", "booked", "planning_in_progress", "finalized"],
    required: false,
  },
];

async function seedDefaults(base44) {
  console.log("[getStatusSettings] Seeding default statuses and groups...");
  // Create statuses
  for (const s of DEFAULT_STATUSES) {
    await base44.asServiceRole.entities.EventStatus.create(s);
  }
  // Create groups
  for (const g of DEFAULT_GROUPS) {
    await base44.asServiceRole.entities.StatusGroup.create(g);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let [statuses, groups] = await Promise.all([
      base44.asServiceRole.entities.EventStatus.list("sort_order", 200),
      base44.asServiceRole.entities.StatusGroup.list("key", 100),
    ]);

    // Seed defaults if empty
    if (statuses.length === 0) {
      await seedDefaults(base44);
      [statuses, groups] = await Promise.all([
        base44.asServiceRole.entities.EventStatus.list("sort_order", 200),
        base44.asServiceRole.entities.StatusGroup.list("key", 100),
      ]);
    }

    return Response.json({
      statuses: statuses.filter(s => s.is_active),
      all_statuses: statuses,
      groups,
    });
  } catch (error) {
    console.error("[getStatusSettings] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});