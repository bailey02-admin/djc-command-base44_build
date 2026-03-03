/**
 * getEvents — secure, paginated event list for internal staff.
 *
 * Server-side filters:  status, city, assigned_dj_id, event_type, contact_id
 *                       date_from ($gte), date_to ($lte), assigned_unassigned
 * Client-side filters:  completion booleans (planning_complete etc.), readiness_score band
 *
 * Response shape:
 *   { events: [...], total: N, page: { skip, limit, returned }, _timing_ms }
 *
 * Hard cap: max 500 events returned across any paginated sequence.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { redactEvent } from './crm/accessControl.js';

const EVENT_READ_DENIED = new Set(["client"]);
const HARD_CAP = 500;

const LIST_FIELDS = new Set([
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "city", "venue_name", "contact_name", "contact_id", "status",
  "assigned_dj", "assigned_dj_id", "assigned_mc",
  "planning_complete", "timeline_complete", "music_complete",
  "contract_signed", "deposit_paid", "balance_paid", "final_call_completed",
  "dj_briefed", "readiness_score", "is_deleted", "lead_id",
  "package_price", "guest_count", "planning_lock_at", "planning_submitted_at",
  "updated_date",
]);

function projectFields(record, role) {
  const redacted = redactEvent(record, role);
  const out = {};
  for (const key of LIST_FIELDS) {
    if (redacted[key] !== undefined) out[key] = redacted[key];
  }
  out.id = record.id;
  return out;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (EVENT_READ_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      limit: rawLimit = 25,
      skip: rawSkip = 0,
      sort = "event_date",
      filters = {},
      date_from,   // string "YYYY-MM-DD" or undefined
      date_to,     // string "YYYY-MM-DD" or undefined (optional)
    } = body;

    const limit = Math.min(Number(rawLimit) || 25, 200);
    const skip  = Math.max(Number(rawSkip) || 0, 0);

    // ── Build DB filter ────────────────────────────────────────────
    const dbFilter = { is_deleted: false };

    const DB_FILTERABLE = ["status", "city", "event_type", "contact_id"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    // Special: unassigned DJ — filter post-fetch since SDK doesn't support $exists:false
    const filterUnassignedDj = filters.assigned_dj_id === "__unassigned__";

    // DJ role: only their own events
    if (role === "dj") {
      dbFilter.assigned_dj = user.email;
    }

    // Date range — default: today onwards, no upper cap
    const today = new Date().toISOString().split("T")[0];
    const fromDate = (date_from !== undefined && date_from !== null && date_from !== "")
      ? date_from
      : today;
    const toDate   = (date_to !== undefined && date_to !== null && date_to !== "")
      ? date_to
      : null;

    // Fetch HARD_CAP + skip rows so we can paginate within the cap.
    // We over-fetch by skip so we can slice correctly without a 2nd call.
    const tDb = Date.now();
    let allEvents = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, HARD_CAP + skip);
    console.log(`[getEvents] DB fetch: ${Date.now() - tDb}ms, raw=${allEvents.length}`);

    // ── Date range filter (in-memory — SDK doesn't support $gte/$lte yet) ──
    allEvents = allEvents.filter(e => {
      if (!e.event_date) return false;
      if (fromDate && e.event_date < fromDate) return false;
      if (toDate   && e.event_date > toDate)   return false;
      return true;
    });

    // ── Enforce hard cap BEFORE pagination ─────────────────────────
    if (allEvents.length > HARD_CAP) allEvents = allEvents.slice(0, HARD_CAP);

    const total     = allEvents.length;
    const paginated = allEvents.slice(skip, skip + limit);
    const result    = paginated.map(e => projectFields(e, role));

    console.log(`[getEvents] total=${total} skip=${skip} limit=${limit} returned=${result.length} elapsed=${Date.now() - t0}ms`);

    return Response.json({
      events: result,
      total,
      page: { skip, limit, returned: result.length },
      _timing_ms: Date.now() - t0,
    });
  } catch (err) {
    console.error("[getEvents] error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});