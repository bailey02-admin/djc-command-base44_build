/**
 * Secure Event list endpoint.
 * Uses centralized access control from crm/accessControl.js.
 *
 * DB scoping:
 *   dj             → scoped to assigned_dj == user.email
 *   all other roles → global (no city filter applied at DB level)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { redactEvent, safeContactSummary } from './crm/accessControl.js';

const EVENT_READ_DENIED = new Set(["client"]);

// Slim field list for list/card views
const LIST_VIEW_FIELDS = new Set([
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "city", "venue_name", "contact_name", "contact_id", "status",
  "assigned_dj", "assigned_dj_id", "assigned_mc",
  "planning_complete", "timeline_complete", "music_complete",
  "contract_signed", "deposit_paid", "balance_paid", "final_call_completed",
  "dj_briefed", "readiness_score", "is_deleted", "lead_id",
  "package_price", "guest_count",
]);

function projectFields(record, role) {
  const redacted = redactEvent(record, role);
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (redacted[key] !== undefined) out[key] = redacted[key];
  }
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
      slim = true,
      include_contact = false,
    } = body;

    const limit = Math.min(Number(rawLimit) || 50, 200);

    const dbFilter = { is_deleted: false };

    const today = new Date().toISOString().split("T")[0];
    const defaultTo = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fromDate = date_from || (slim ? today : null);
    const toDate   = date_to   || (slim ? defaultTo : null);

    const DB_FILTERABLE = ["status", "city", "assigned_dj_id", "event_type", "contact_id"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    // Role-based DB scoping:
    //   DJ only → scope to their assigned events
    //   Everyone else (including city_manager, office_finalizer) → global
    if (role === "dj") {
      dbFilter.assigned_dj = user.email;
    }

    let events = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, limit + skip);

    if (fromDate) events = events.filter(e => e.event_date >= fromDate);
    if (toDate)   events = events.filter(e => e.event_date <= toDate);

    const paginated = events.slice(skip, skip + limit);
    const withAlias = (e) => ({ ...e, event_id: e.id });

    let result = slim
      ? paginated.map(e => withAlias(projectFields(e, role)))
      : paginated.map(e => withAlias(redactEvent(e, role)));

    // Optional: batch-resolve contact summaries (not for DJ)
    if (include_contact && role !== "dj") {
      const contactIds = [...new Set(result.filter(e => e.contact_id).map(e => e.contact_id))];
      if (contactIds.length > 0) {
        const contactMap = {};
        const BATCH = 10;
        for (let i = 0; i < contactIds.length; i += BATCH) {
          const batch = contactIds.slice(i, i + BATCH);
          const fetched = await Promise.all(
            batch.map(cid =>
              base44.asServiceRole.entities.Contact.filter({ id: cid })
                .then(rows => rows[0] || null)
                .catch(() => null)
            )
          );
          for (const c of fetched) {
            if (c) contactMap[c.id] = safeContactSummary(c, role);
          }
        }
        result = result.map(e => ({
          ...e,
          contact: e.contact_id ? (contactMap[e.contact_id] || null) : null,
        }));
      }
    }

    return Response.json({
      events: result,
      total: events.length,
      page: { skip, limit, returned: result.length },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});