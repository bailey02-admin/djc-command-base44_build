/**
 * Admin-only: Delete all transactional demo/test data, then ensure LabelMap is complete
 * WITHOUT clobbering user-edited labels.
 *
 * LabelMap identity: (category, key) — NOT global key uniqueness.
 * "booked_pending" exists in both lead_status and event_status; that is intentional.
 *
 * CalendarItem deletion: SKIPPED (Option B) — CalendarItems are not tagged as
 * demo/transactional yet; wiping them risks deleting real config rows.
 * The seed function does not create CalendarItems either.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Canonical label map — identity is (category, key).
// "booked_pending" appears twice (lead_status + event_status) — this is correct.
// Labels here are DEFAULTS ONLY — never overwrite user edits.
const CANONICAL_LABEL_MAP = [
  { key: "web_lead",             label: "Web Lead",             category: "lead_status",   sort_order: 1 },
  { key: "email_only",           label: "Email Only Lead",      category: "lead_status",   sort_order: 2 },
  { key: "bridal_show_lead",     label: "Bridal Show Lead",     category: "lead_status",   sort_order: 3 },
  { key: "corporate_lead",       label: "Corporate Lead",       category: "lead_status",   sort_order: 4 },
  { key: "hot_lead",             label: "Hot Lead",             category: "lead_status",   sort_order: 5 },
  { key: "appointment_set",      label: "Appointment Set",      category: "lead_status",   sort_order: 6 },
  { key: "missed_appointment",   label: "Missed Appointment",   category: "lead_status",   sort_order: 7 },
  { key: "x_dated",              label: "X Dated",              category: "lead_status",   sort_order: 8 },
  { key: "never_booked",         label: "Never Booked",         category: "lead_status",   sort_order: 9 },
  { key: "lost_sale",            label: "Lost Sale",            category: "lead_status",   sort_order: 10 },
  { key: "booked_pending",       label: "Booked - Pending",     category: "lead_status",   sort_order: 11 },
  { key: "contract_overdue",     label: "Contract Overdue",     category: "lead_flag",     sort_order: 1 },
  { key: "do_not_call",          label: "DO NOT CALL",          category: "lead_flag",     sort_order: 2 },
  { key: "booked_pending",       label: "Booked - Pending",     category: "event_status",  sort_order: 1 },
  { key: "booked",               label: "Booked",               category: "event_status",  sort_order: 2 },
  { key: "planning_in_progress", label: "Planning In Progress", category: "event_status",  sort_order: 3 },
  { key: "finalized",            label: "Finalized",            category: "event_status",  sort_order: 4 },
  { key: "completed",            label: "Completed",            category: "event_status",  sort_order: 5 },
  { key: "cancelled",            label: "Cancelled",            category: "event_status",  sort_order: 6 },
  { key: "postponed",            label: "Postponed",            category: "event_status",  sort_order: 7 },
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
  { key: "bridal_show",     label: "Bridal Show",     category: "calendar_type", sort_order: 1 },
  { key: "training",        label: "Training",        category: "calendar_type", sort_order: 2 },
  { key: "runner_shift",    label: "Runner Shift",    category: "shift_type",    sort_order: 1 },
  { key: "warehouse_shift", label: "Warehouse Shift", category: "shift_type",    sort_order: 2 },
  { key: "office_shift",    label: "Office Shift",    category: "shift_type",    sort_order: 3 },
];

// Paginate through ALL rows of an entity and delete them.
// Identifies demo rows by source_detail = "DEMO_SEED_v1" for Lead,
// or internal_notes containing "DEMO_SEED_v1" for Event.
// For Activity/Task/Payment/AutomationLog — delete ALL rows (they are always transactional).
async function deleteAllRows(svc, entityName) {
  let deleted = 0;
  let page = 0;
  const pageSize = 200;
  while (true) {
    const rows = await svc.entities[entityName].list("-created_date", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    await Promise.all(rows.map(r => svc.entities[entityName].delete(r.id)));
    deleted += rows.length;
    if (rows.length < pageSize) break;
    page++;
  }
  return deleted;
}

// Delete only demo-tagged rows (source_detail = "DEMO_SEED_v1")
// Uses pageSize=500 + chunked deletes to handle 250+ demo rows reliably
async function deleteDemoLeads(svc) {
  let deleted = 0;
  let page = 0;
  const pageSize = 500;
  while (true) {
    const rows = await svc.entities.Lead.list("-created_date", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    const demoRows = rows.filter(r => r.source_detail === "DEMO_SEED_v1");
    // Chunked delete to avoid overwhelming the API
    for (let i = 0; i < demoRows.length; i += 50) {
      await Promise.all(demoRows.slice(i, i + 50).map(r => svc.entities.Lead.delete(r.id)));
    }
    deleted += demoRows.length;
    if (rows.length < pageSize) break;
    page++;
  }
  return deleted;
}

async function deleteDemoEvents(svc) {
  let deleted = 0;
  let page = 0;
  const pageSize = 500;
  while (true) {
    const rows = await svc.entities.Event.list("-created_date", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    const demoRows = rows.filter(r => r.internal_notes && r.internal_notes.includes("DEMO_SEED_v1"));
    // Chunked delete
    for (let i = 0; i < demoRows.length; i += 50) {
      await Promise.all(demoRows.slice(i, i + 50).map(r => svc.entities.Event.delete(r.id)));
    }
    deleted += demoRows.length;
    if (rows.length < pageSize) break;
    page++;
  }
  return deleted;
}

// Fetch ALL LabelMap rows with pagination
async function getAllLabelMapRows(svc) {
  const all = [];
  let page = 0;
  const pageSize = 200;
  while (true) {
    const rows = await svc.entities.LabelMap.list("sort_order", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    page++;
  }
  return all;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    const svc = base44.asServiceRole;

    // Delete demo-tagged transactional data (Lead/Event filtered; others all-rows)
    const [leads, events, activities, tasks, payments, automationLogs] = await Promise.all([
      deleteDemoLeads(svc),
      deleteDemoEvents(svc),
      deleteAllRows(svc, "Activity"),
      deleteAllRows(svc, "Task"),
      deleteAllRows(svc, "Payment"),
      deleteAllRows(svc, "AutomationLog"),
      // CalendarItem intentionally excluded — not transactional/tagged yet
    ]);

    // --- NON-DESTRUCTIVE LabelMap patch ---
    // Build existing set by compound identity: "category::key"
    const existingRows = await getAllLabelMapRows(svc);
    const existingSet = new Set(existingRows.map(r => `${r.category}::${r.key}`));

    const missingKeys = [];
    const toInsert = CANONICAL_LABEL_MAP.filter(canonical => {
      const id = `${canonical.category}::${canonical.key}`;
      if (!existingSet.has(id)) {
        missingKeys.push(id);
        return true;
      }
      return false;
    });

    if (toInsert.length > 0) {
      await Promise.all(toInsert.map(r => svc.entities.LabelMap.create({ ...r, is_active: true })));
    }

    const finalRows = await getAllLabelMapRows(svc);

    return Response.json({
      ok: true,
      deleted: { leads, events, activities, tasks, payments, automationLogs, calendarItems: 0 },
      labelMap: {
        existingCount: existingRows.length,
        insertedCount: toInsert.length,
        finalCount: finalRows.length,
        missingKeys,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});