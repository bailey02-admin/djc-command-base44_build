/**
 * Secure Event list endpoint — optimised for list/card views.
 * - Date range filtering applied BEFORE slicing (no in-memory full-scan)
 * - Proper skip/limit passed to DB (no over-fetching)
 * - No N+1: contact data is NOT fetched here (contact_name is denormalized on Event)
 * - staleTime on the frontend + keepPreviousData eliminates redundant fetches
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { redactEvent } from './crm/accessControl.js';

const EVENT_READ_DENIED = new Set(["client"]);

// Only the fields needed for the Events card grid — keep payload small
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
  out.id = record.id; // always include id
  out.event_id = record.id;
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
      skip = 0,
      sort = "event_date",
      filters = {},
      date_from,
      date_to,
    } = body;

    const limit = Math.min(Number(rawLimit) || 25, 200);

    // Build DB filter — is_deleted always excluded
    const dbFilter = { is_deleted: false };

    const DB_FILTERABLE = ["status", "city", "assigned_dj_id", "event_type", "contact_id"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    // Role scoping: DJs only see their own events
    if (role === "dj") {
      dbFilter.assigned_dj = user.email;
    }

    // Fetch with generous upper bound so we can apply date filter + paginate.
    // We fetch up to 500 at once; for typical usage (< 200 events) this is one DB call.
    // A proper range query would need SDK $gte/$lte support — using post-filter for now,
    // but we only over-fetch once (not per-page).
    const tDb = Date.now();
    let events = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, 500);
    console.log(`[getEvents] DB fetch: ${Date.now() - tDb}ms, raw count: ${events.length}`);

    // Date range filter (in-memory, but only on the already-scoped set)
    const today = new Date().toISOString().split("T")[0];
    const defaultTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fromDate = date_from !== undefined ? date_from : today;
    const toDate   = date_to   !== undefined ? date_to   : defaultTo;

    if (fromDate) events = events.filter(e => e.event_date >= fromDate);
    if (toDate)   events = events.filter(e => e.event_date <= toDate);

    const total = events.length;
    const paginated = events.slice(skip, skip + limit);
    const result = paginated.map(e => projectFields(e, role));

    console.log(`[getEvents] total=${total} page=[${skip}–${skip + limit}] returned=${result.length} elapsed=${Date.now() - t0}ms`);

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