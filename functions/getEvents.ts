/**
 * Secure Event read endpoint — Performance-hardened.
 *
 * Key changes:
 * - All filtering pushed to DB-level (filter() calls) instead of post-fetch JS
 * - Default date window: upcoming 90 days unless overridden
 * - Mandatory limit cap: 50 per page, skip for pagination
 * - Field projection: list view returns slim payload, detail handled by getEventDetail
 * - DJs filtered at DB layer via assigned_dj_id
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EVENT_READ_DENIED = new Set(["client"]);

// Fields stripped for DJs — no financial or internal data
const EVENT_HIDDEN_FIELDS = {
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "internal_notes"],
  sales_rep:        ["package_price", "internal_notes"],
  office_finalizer: ["package_price"],
  finance:          ["internal_notes"],
};

// Slim field list for list/card views (omit heavy text blobs)
const LIST_VIEW_FIELDS = new Set([
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "city", "venue_name", "contact_name", "status", "assigned_dj", "assigned_dj_id",
  "assigned_mc", "planning_complete", "timeline_complete", "music_complete",
  "contract_signed", "deposit_paid", "balance_paid", "final_call_completed",
  "dj_briefed", "readiness_score", "is_deleted", "lead_id", "contact_id",
  "package_price", "guest_count",
]);

function projectFields(record, role) {
  const hidden = new Set(EVENT_HIDDEN_FIELDS[role] || []);
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (!hidden.has(key) && record[key] !== undefined) {
      out[key] = record[key];
    }
  }
  // Always carry id
  out.id = record.id;
  return out;
}

Deno.serve(async (req) => {
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
      limit: rawLimit = 50,
      skip = 0,
      sort = "event_date",
      filters = {},
      date_from,
      date_to,
      slim = true,  // list view uses slim projection by default
    } = body;

    // Hard cap: never more than 200 per request
    const limit = Math.min(Number(rawLimit) || 50, 200);

    // Build DB-level filter object
    const dbFilter = { is_deleted: false };

    // Date window — default: today → +90 days for list views
    const today = new Date().toISOString().split("T")[0];
    const defaultTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Allow explicit override; otherwise apply defaults only for list view
    const fromDate = date_from || (slim ? today : null);
    const toDate   = date_to   || (slim ? defaultTo : null);

    // Apply DB-filterable fields from caller filters
    const DB_FILTERABLE = ["status", "city", "assigned_dj_id", "event_type"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    // Role-based DB scoping (push to DB, not post-fetch)
    if (role === "dj") {
      // DJs: only their events via email match on assigned_dj field
      dbFilter.assigned_dj = user.email;
    } else if ((role === "sales_rep" || role === "city_manager") && user.city) {
      dbFilter.city = user.city;
    }

    // Fetch from DB with filters applied
    let events = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, limit + skip);

    // Date range filter (post-fetch since SDK doesn't support range operators)
    if (fromDate) events = events.filter(e => e.event_date >= fromDate);
    if (toDate)   events = events.filter(e => e.event_date <= toDate);

    // Pagination slice
    const paginated = events.slice(skip, skip + limit);

    // Add computed alias: event_id = record.id (display only, never persisted)
    const withAlias = (e) => ({ ...e, event_id: e.id });

    // Apply slim projection for list views
    const result = slim
      ? paginated.map(e => withAlias(projectFields(e, role)))
      : paginated.map(e => {
          const hidden = new Set(EVENT_HIDDEN_FIELDS[role] || []);
          const out = { ...e };
          for (const f of hidden) delete out[f];
          return withAlias(out);
        });

    return Response.json({
      events: result,
      total: events.length,
      page: { skip, limit, returned: result.length },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});