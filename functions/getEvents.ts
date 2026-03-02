/**
 * Secure Event read endpoint — Performance-hardened.
 * Includes contact_id in list view; contact summary injected when present.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EVENT_READ_DENIED = new Set(["client"]);

const EVENT_HIDDEN_FIELDS = {
  dj:               ["package_price", "contact_email", "contact_phone", "lead_id", "internal_notes"],
  sales_rep:        ["package_price", "internal_notes"],
  office_finalizer: ["package_price"],
  finance:          ["internal_notes"],
};

// Slim field list for list/card views — contact_id included for Contact-first arch
const LIST_VIEW_FIELDS = new Set([
  "id", "event_name", "event_type", "event_date", "start_time", "end_time",
  "city", "venue_name", "contact_name", "contact_id", "status", "assigned_dj", "assigned_dj_id",
  "assigned_mc", "planning_complete", "timeline_complete", "music_complete",
  "contract_signed", "deposit_paid", "balance_paid", "final_call_completed",
  "dj_briefed", "readiness_score", "is_deleted", "lead_id",
  "package_price", "guest_count",
]);

const CONTACT_SUMMARY_FIELDS = ["id", "first_name", "last_name", "email", "phone", "preferred_contact_method", "city", "role"];

function projectFields(record, role) {
  const hidden = new Set(EVENT_HIDDEN_FIELDS[role] || []);
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (!hidden.has(key) && record[key] !== undefined) {
      out[key] = record[key];
    }
  }
  out.id = record.id;
  return out;
}

function safeContactSummary(contact) {
  if (!contact) return null;
  const out = {};
  for (const f of CONTACT_SUMMARY_FIELDS) {
    if (contact[f] !== undefined) out[f] = contact[f];
  }
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
      include_contact = false, // set true to batch-resolve contact summaries
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

    // Role-based DB scoping
    if (role === "dj") {
      dbFilter.assigned_dj = user.email;
    } else if ((role === "sales_rep" || role === "city_manager") && user.city) {
      dbFilter.city = user.city;
    }

    let events = await base44.asServiceRole.entities.Event.filter(dbFilter, sort, limit + skip);

    if (fromDate) events = events.filter(e => e.event_date >= fromDate);
    if (toDate)   events = events.filter(e => e.event_date <= toDate);

    const paginated = events.slice(skip, skip + limit);
    const withAlias = (e) => ({ ...e, event_id: e.id });

    let result = slim
      ? paginated.map(e => withAlias(projectFields(e, role)))
      : paginated.map(e => {
          const hidden = new Set(EVENT_HIDDEN_FIELDS[role] || []);
          const out = { ...e };
          for (const f of hidden) delete out[f];
          return withAlias(out);
        });

    // Optional: batch-resolve contact summaries (not for DJ/client role)
    if (include_contact && !["dj", "client"].includes(role)) {
      const contactIds = [...new Set(result.filter(e => e.contact_id).map(e => e.contact_id))];
      if (contactIds.length > 0) {
        // Fetch all needed contacts in parallel batches of 10
        const contactMap = {};
        const BATCH = 10;
        for (let i = 0; i < contactIds.length; i += BATCH) {
          const batch = contactIds.slice(i, i + BATCH);
          const fetched = await Promise.all(
            batch.map(cid =>
              base44.asServiceRole.entities.Contact.filter({ id: cid }).then(rows => rows[0] || null).catch(() => null)
            )
          );
          for (const c of fetched) {
            if (c) contactMap[c.id] = safeContactSummary(c);
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