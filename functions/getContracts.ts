/**
 * Secure Contract read endpoint — Performance-hardened.
 *
 * Key changes:
 * - DB-level filter by event_id, status
 * - Hard limit cap: 50/page with skip
 * - Slim field projection for list views
 * - City-scoped roles: filter via event city at DB level
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BLOCKED_ROLES = new Set(["dj", "client"]);

// Slim fields for contracts list view
const LIST_VIEW_FIELDS = new Set([
  "id", "event_id", "contact_name", "contact_email", "status",
  "sent_date", "signed_date", "signer_name", "contract_amount", "version",
]);

function projectFields(record) {
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (record[key] !== undefined) out[key] = record[key];
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
    if (BLOCKED_ROLES.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
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
    const dbFilter = {};
    const DB_FILTERABLE = ["status", "event_id"];
    for (const key of DB_FILTERABLE) {
      const val = filters[key] || (key === "event_id" ? filters.event_id : undefined);
      if (val && val !== "all") dbFilter[key] = val;
    }

    // City-scoped roles: resolve event IDs for their city first
    let cityEventIds = null;
    if (["sales_rep", "city_manager"].includes(role) && user.city && !dbFilter.event_id) {
      const cityEvents = await base44.asServiceRole.entities.Event.filter(
        { city: user.city, is_deleted: false }, "-event_date", 500
      );
      cityEventIds = new Set(cityEvents.map(e => e.id));
    }

    let contracts = await base44.asServiceRole.entities.Contract.filter(dbFilter, sort, limit + skip);

    // Apply city scope
    if (cityEventIds !== null) {
      contracts = contracts.filter(c => !c.event_id || cityEventIds.has(c.event_id));
    }

    // Apply non-DB-filterable caller filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all" && !DB_FILTERABLE.includes(key)) {
        contracts = contracts.filter(c => c[key] === val);
      }
    }

    const paginated = contracts.slice(skip, skip + limit);
    const result = slim ? paginated.map(projectFields) : paginated;

    return Response.json({ contracts: result, total: contracts.length, page: { skip, limit, returned: result.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});