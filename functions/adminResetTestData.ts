/**
 * Admin-only: Delete demo/test data, then ensure LabelMap is complete
 * WITHOUT clobbering user-edited labels.
 *
 * LabelMap identity: (category, key) — NOT global key uniqueness.
 * "booked_pending" appears in both lead_status and event_status — intentional.
 * CalendarItem deletion: SKIPPED — not demo-tagged, risk of deleting real config rows.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Track total retries for the response summary
let totalRetries = 0;
let maxBackoffUsed = 0;

async function withRetry(fn, maxAttempts = 6, baseDelayMs = 300) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 =
        err?.status === 429 ||
        err?.statusCode === 429 ||
        (err?.message && (err.message.includes('429') || err.message.toLowerCase().includes('rate limit')));
      if (is429 && attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        totalRetries++;
        if (delay > maxBackoffUsed) maxBackoffUsed = delay;
        console.log(`Rate limited. Retry ${attempt}/${maxAttempts} after ${delay}ms`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

// Delete an array of IDs in batches of 5, 200ms between batches
async function deleteBatched(svc, entityName, ids) {
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 200;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    // Sequential within batch (not Promise.all) to keep concurrency low
    for (const id of batch) {
      await withRetry(() => svc.entities[entityName].delete(id));
      deleted++;
    }
    if (i + BATCH_SIZE < ids.length) await sleep(BATCH_DELAY);
  }
  return deleted;
}

// Paginate + delete all rows of any entity (for transactional tables)
async function deleteAllRows(svc, entityName) {
  let deleted = 0;
  let page = 0;
  const pageSize = 200;
  while (true) {
    const rows = await svc.entities[entityName].list("-created_date", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    deleted += await deleteBatched(svc, entityName, rows.map(r => r.id));
    if (rows.length < pageSize) break;
    page++;
  }
  return deleted;
}

// Delete only DEMO_SEED_v1-tagged Leads
async function deleteDemoLeads(svc) {
  let deleted = 0;
  let page = 0;
  const pageSize = 200;
  while (true) {
    const rows = await svc.entities.Lead.list("-created_date", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    const demoIds = rows
      .filter(r => r.source_detail === "DEMO_SEED_v1" || (r.notes && r.notes.includes("DEMO_SEED_v1")))
      .map(r => r.id);
    if (demoIds.length > 0) {
      deleted += await deleteBatched(svc, "Lead", demoIds);
    }
    if (rows.length < pageSize) break;
    page++;
  }
  return deleted;
}

// Delete only DEMO_SEED_v1-tagged Events
async function deleteDemoEvents(svc) {
  let deleted = 0;
  let page = 0;
  const pageSize = 200;
  while (true) {
    const rows = await svc.entities.Event.list("-created_date", pageSize, page * pageSize);
    if (!rows || rows.length === 0) break;
    const demoIds = rows
      .filter(r => r.internal_notes && r.internal_notes.includes("DEMO_SEED_v1"))
      .map(r => r.id);
    if (demoIds.length > 0) {
      deleted += await deleteBatched(svc, "Event", demoIds);
    }
    if (rows.length < pageSize) break;
    page++;
  }
  return deleted;
}

// Fetch all LabelMap rows with pagination
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

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: admin only" }, { status: 403 });

    // Reset counters per request
    totalRetries = 0;
    maxBackoffUsed = 0;

    const svc = base44.asServiceRole;

    // Delete in sequence (NOT Promise.all) to stay within rate limits
    const leads = await deleteDemoLeads(svc);
    const events = await deleteDemoEvents(svc);
    const activities = await deleteAllRows(svc, "Activity");
    const tasks = await deleteAllRows(svc, "Task");
    const payments = await deleteAllRows(svc, "Payment");
    const automationLogs = await deleteAllRows(svc, "AutomationLog");
    // CalendarItem intentionally excluded

    // ── Non-destructive LabelMap patch ──────────────────────────────────────
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

    // Insert missing labels sequentially with retry
    for (const row of toInsert) {
      await withRetry(() => svc.entities.LabelMap.create({ ...row, is_active: true }));
      await sleep(50);
    }

    const finalRows = await getAllLabelMapRows(svc);

    return Response.json({
      ok: true,
      deleted: { leads, events, activities, tasks, payments, automationLogs },
      labelMap: {
        existingCount: existingRows.length,
        insertedCount: toInsert.length,
        finalCount: finalRows.length,
        missingKeys,
      },
      rateLimitRetries: {
        totalRetries,
        maxBackoffMs: maxBackoffUsed,
      },
    });
  } catch (err) {
    return Response.json({
      error: err.message,
      rateLimitRetries: { totalRetries, maxBackoffMs: maxBackoffUsed },
    }, { status: 500 });
  }
});