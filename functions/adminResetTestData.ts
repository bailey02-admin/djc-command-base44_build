/**
 * Admin-only: Delete all transactional data and ensure LabelMap is seeded.
 * Does NOT delete LabelMap, Settings, MessageTemplate, Venue, DJProfile, or other config entities.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CANONICAL_LABEL_MAP = [
  { key: "web_lead",           label: "Web Lead",            category: "lead_status",   sort_order: 1 },
  { key: "email_only",         label: "Email Only Lead",     category: "lead_status",   sort_order: 2 },
  { key: "bridal_show_lead",   label: "Bridal Show Lead",    category: "lead_status",   sort_order: 3 },
  { key: "corporate_lead",     label: "Corporate Lead",      category: "lead_status",   sort_order: 4 },
  { key: "hot_lead",           label: "Hot Lead",            category: "lead_status",   sort_order: 5 },
  { key: "appointment_set",    label: "Appointment Set",     category: "lead_status",   sort_order: 6 },
  { key: "missed_appointment", label: "Missed Appointment",  category: "lead_status",   sort_order: 7 },
  { key: "x_dated",            label: "X Dated",             category: "lead_status",   sort_order: 8 },
  { key: "never_booked",       label: "Never Booked",        category: "lead_status",   sort_order: 9 },
  { key: "lost_sale",          label: "Lost Sale",           category: "lead_status",   sort_order: 10 },
  { key: "booked_pending",     label: "Booked - Pending",    category: "lead_status",   sort_order: 11 },
  { key: "contract_overdue",   label: "Contract Overdue",    category: "lead_flag",     sort_order: 1 },
  { key: "do_not_call",        label: "DO NOT CALL",         category: "lead_flag",     sort_order: 2 },
  { key: "booked_pending",     label: "Booked - Pending",    category: "event_status",  sort_order: 1 },
  { key: "booked",             label: "Booked",              category: "event_status",  sort_order: 2 },
  { key: "planning_in_progress", label: "Planning In Progress", category: "event_status", sort_order: 3 },
  { key: "finalized",          label: "Finalized",           category: "event_status",  sort_order: 4 },
  { key: "completed",          label: "Completed",           category: "event_status",  sort_order: 5 },
  { key: "cancelled",          label: "Cancelled",           category: "event_status",  sort_order: 6 },
  { key: "postponed",          label: "Postponed",           category: "event_status",  sort_order: 7 },
  { key: "TUL",   label: "Tulsa",         category: "city", sort_order: 1 },
  { key: "DFW",   label: "DFW",           category: "city", sort_order: 2 },
  { key: "HOU",   label: "Houston",       category: "city", sort_order: 3 },
  { key: "SAT",   label: "San Antonio",   category: "city", sort_order: 4 },
  { key: "KC",    label: "Kansas City",   category: "city", sort_order: 5 },
  { key: "STL",   label: "St. Louis",     category: "city", sort_order: 6 },
  { key: "INDY",  label: "Indianapolis",  category: "city", sort_order: 7 },
  { key: "NASH",  label: "Nashville",     category: "city", sort_order: 8 },
  { key: "DEN",   label: "Denver",        category: "city", sort_order: 9 },
  { key: "ATL",   label: "Atlanta",       category: "city", sort_order: 10 },
  { key: "bridal_show",      label: "Bridal Show",      category: "calendar_type", sort_order: 1 },
  { key: "training",         label: "Training",         category: "calendar_type", sort_order: 2 },
  { key: "runner_shift",     label: "Runner Shift",     category: "shift_type",    sort_order: 1 },
  { key: "warehouse_shift",  label: "Warehouse Shift",  category: "shift_type",    sort_order: 2 },
  { key: "office_shift",     label: "Office Shift",     category: "shift_type",    sort_order: 3 },
];

async function deleteAll(svc, entityName) {
  let deleted = 0;
  let rows = await svc.entities[entityName].list("-created_date", 200);
  while (rows.length > 0) {
    await Promise.all(rows.map(r => svc.entities[entityName].delete(r.id)));
    deleted += rows.length;
    rows = await svc.entities[entityName].list("-created_date", 200);
  }
  return deleted;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const svc = base44.asServiceRole;

    // Delete all transactional entities
    const [leads, events, activities, tasks, payments, automationLogs, calendarItems] = await Promise.all([
      deleteAll(svc, "Lead"),
      deleteAll(svc, "Event"),
      deleteAll(svc, "Activity"),
      deleteAll(svc, "Task"),
      deleteAll(svc, "Payment"),
      deleteAll(svc, "AutomationLog"),
      deleteAll(svc, "CalendarItem"),
    ]);

    // Verify LabelMap — reseed if missing or incomplete
    const existingLabels = await svc.entities.LabelMap.list("-created_date", 200);
    let labelMapCount = existingLabels.length;
    let reseeded = false;

    if (labelMapCount < 35) {
      // Clear any partial records then reseed fully
      await Promise.all(existingLabels.map(r => svc.entities.LabelMap.delete(r.id)));
      await Promise.all(
        CANONICAL_LABEL_MAP.map(r => svc.entities.LabelMap.create({ ...r, is_active: true }))
      );
      const after = await svc.entities.LabelMap.list("-created_date", 200);
      labelMapCount = after.length;
      reseeded = true;
    }

    return Response.json({
      ok: true,
      deleted: { leads, events, activities, tasks, payments, automationLogs, calendarItems },
      labelMapCount,
      labelMapReseeded: reseeded,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});