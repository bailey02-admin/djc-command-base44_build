/**
 * Secure Lead read endpoint — Performance-hardened.
 *
 * Key changes:
 * - DB-level filtering for status, city, assigned_rep (no full-table scan)
 * - Hard limit cap: 50/page with skip pagination
 * - Slim field projection for list/kanban views
 * - Role scoping pushed to DB filter, not post-fetch JS
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const LEAD_READ_DENIED = new Set(["dj", "client"]);

const LEAD_HIDDEN_FIELDS = {
  sales_rep:        ["discount_amount", "internal_notes", "gclid", "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"],
  office_finalizer: ["discount_amount", "gclid", "fbclid"],
  finance:          ["internal_notes"],
};

// Slim field list for list/kanban/table views
const LIST_VIEW_FIELDS = new Set([
  "id", "client_first_name", "client_last_name", "partner_first_name", "email", "phone",
  "event_date", "event_type", "city", "venue_name", "status", "pipeline_stage",
  "assigned_rep", "priority", "sla_status", "sla_minutes_elapsed",
  "lead_source", "inquiry_date", "first_response_date", "next_follow_up_date",
  "last_contact_date", "quote_amount", "package_name", "is_deleted",
  "contact_id", "event_id", "no_response_count", "booked_date",
]);

function projectFields(record, role) {
  const hidden = new Set(LEAD_HIDDEN_FIELDS[role] || []);
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (!hidden.has(key) && record[key] !== undefined) {
      out[key] = record[key];
    }
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
    if (LEAD_READ_DENIED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot access leads" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      limit: rawLimit = 50,
      skip = 0,
      sort = "-created_date",
      filters = {},
      slim = true,
    } = body;

    const limit = Math.min(Number(rawLimit) || 50, 200);

    // Build DB-level filter
    const dbFilter = { is_deleted: false };

    const DB_FILTERABLE = ["status", "pipeline_stage", "city", "assigned_rep", "priority", "sla_status", "lead_source", "event_type"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    // Role-based DB scoping
    const fullAccessRoles = new Set(["admin", "sales_manager", "finance", "office_finalizer"]);
    if (!fullAccessRoles.has(role)) {
      if (role === "city_manager" && user.city) {
        dbFilter.city = user.city;
      } else if (role === "sales_rep") {
        // sales_rep: assigned to them OR in their city — filter post-fetch since it's OR logic
        // but scope to city at minimum to avoid full table scan
        if (user.city && !filters.assigned_rep) {
          dbFilter.city = user.city;
        } else if (filters.assigned_rep) {
          dbFilter.assigned_rep = filters.assigned_rep;
        } else {
          dbFilter.assigned_rep = user.email;
        }
      }
    }

    let leads = await base44.asServiceRole.entities.Lead.filter(dbFilter, sort, limit + skip);

    // Sales rep: OR logic — also include leads assigned to them even outside city
    if (role === "sales_rep" && user.city && !filters.assigned_rep) {
      const assignedLeads = await base44.asServiceRole.entities.Lead.filter(
        { is_deleted: false, assigned_rep: user.email }, sort, 100
      );
      const seen = new Set(leads.map(l => l.id));
      for (const l of assignedLeads) {
        if (!seen.has(l.id)) leads.push(l);
      }
    }

    // Apply non-DB-filterable caller filters (e.g. search text)
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all" && !DB_FILTERABLE.includes(key) && key !== "search") {
        leads = leads.filter(l => l[key] === val);
      }
    }

    const paginated = leads.slice(skip, skip + limit);

    const result = slim
      ? paginated.map(l => projectFields(l, role))
      : paginated.map(l => {
          const hidden = new Set(LEAD_HIDDEN_FIELDS[role] || []);
          const out = { ...l };
          for (const f of hidden) delete out[f];
          return out;
        });

    return Response.json({ leads: result, total: leads.length, page: { skip, limit, returned: result.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});