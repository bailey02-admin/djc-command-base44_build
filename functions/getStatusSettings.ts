/**
 * getStatusSettings — returns all EventStatus + StatusGroup records (scoped to entity_key).
 * On first load (no statuses exist), seeds defaults.
 * If statuses exist but event groups are missing, seeds event groups only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_STATUSES = [
  { key: "booked_pending",       label: "Booked Pending",       color: "bg-sky-50 text-sky-700 border-sky-200",          sort_order: 0,  is_active: true },
  { key: "booked",               label: "Booked",               color: "bg-blue-50 text-blue-700 border-blue-200",        sort_order: 10, is_active: true },
  { key: "planning_in_progress", label: "Planning In Progress", color: "bg-violet-50 text-violet-700 border-violet-200",  sort_order: 20, is_active: true },
  { key: "finalized",            label: "Finalized",            color: "bg-purple-50 text-purple-700 border-purple-200",  sort_order: 30, is_active: true },
  { key: "completed",            label: "Completed",            color: "bg-green-50 text-green-700 border-green-200",     sort_order: 40, is_active: true },
  { key: "cancelled",            label: "Cancelled",            color: "bg-red-50 text-red-700 border-red-200",           sort_order: 50, is_active: true },
  { key: "postponed",            label: "Postponed",            color: "bg-amber-50 text-amber-700 border-amber-200",     sort_order: 60, is_active: true },
];

const DEFAULT_EVENT_GROUPS = [
  {
    entity_key: "event",
    key: "official_booked",
    label: "Official Booked Statuses",
    description: "Events in these statuses are considered officially booked — triggers quote snapshot and payment schedule creation.",
    statuses: ["booked_pending", "booked"],
    required: true,
  },
  {
    entity_key: "event",
    key: "finalized_group",
    label: "Finalized Statuses",
    description: "Events in these statuses have completed all planning steps.",
    statuses: ["finalized"],
    required: false,
  },
  {
    entity_key: "event",
    key: "post_event",
    label: "Post-Event Statuses",
    description: "Events that have concluded (completed or cancelled).",
    statuses: ["completed", "cancelled"],
    required: false,
  },
  {
    entity_key: "event",
    key: "finance_visible",
    label: "Finance Visible Statuses",
    description: "Events in these statuses appear in Finance reports (Payments list, Income by Month, A/R). Cancelled and Postponed are excluded by default.",
    statuses: ["booked_pending", "booked", "planning_in_progress", "finalized", "completed"],
    required: true,
  },
];

async function seedDefaults(base44) {
  console.log("[getStatusSettings] Seeding default statuses and event groups...");
  for (const s of DEFAULT_STATUSES) {
    await base44.asServiceRole.entities.EventStatus.create(s);
  }
  for (const g of DEFAULT_EVENT_GROUPS) {
    await base44.asServiceRole.entities.StatusGroup.create(g);
  }
}

async function seedMissingEventGroups(base44, existingGroups) {
  const existingKeys = new Set(existingGroups.filter(g => g.entity_key === "event").map(g => g.key));
  const missing = DEFAULT_EVENT_GROUPS.filter(g => !existingKeys.has(g.key));
  if (missing.length === 0) return;
  console.log("[getStatusSettings] Seeding missing event groups:", missing.map(g => g.key).join(", "));
  for (const g of missing) {
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

    // Seed everything if statuses are missing
    if (statuses.length === 0) {
      await seedDefaults(base44);
      [statuses, groups] = await Promise.all([
        base44.asServiceRole.entities.EventStatus.list("sort_order", 200),
        base44.asServiceRole.entities.StatusGroup.list("key", 100),
      ]);
    } else {
      // Statuses exist — ensure event groups are seeded (handles migration of old records)
      const eventGroups = groups.filter(g => g.entity_key === "event" || (!g.entity_key && ["official_booked","finalized","active","finalized_group","post_event"].includes(g.key)));
      if (eventGroups.length === 0) {
        await seedMissingEventGroups(base44, groups);
        groups = await base44.asServiceRole.entities.StatusGroup.list("key", 100);
      }
    }

    const eventGroups = groups.filter(g => (g.entity_key || "event") === "event");
    return Response.json({
      statuses: statuses.filter(s => s.is_active),
      all_statuses: statuses,
      groups,
      eventGroups,
    });
  } catch (error) {
    console.error("[getStatusSettings] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});