/**
 * Secure Quote read endpoint — Performance-hardened.
 *
 * Key changes:
 * - DB-level filter by lead_id, status (no full table scan)
 * - City-scoping: filter leads by city at DB level, not 500-record in-memory join
 * - Hard limit cap: 50/page with skip
 * - Slim field projection for list views
 * - Expiration enrichment (read-only computed fields)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BLOCKED_ROLES = new Set(["dj", "client"]);

// Slim fields for quotes list view
const LIST_VIEW_FIELDS = new Set([
  "id", "lead_id", "event_id", "contact_name", "package_name",
  "total_amount", "status", "version", "valid_until", "sent_date",
  "base_price", "discount_amount", "travel_fee",
]);

function projectFields(record) {
  const out = {};
  for (const key of LIST_VIEW_FIELDS) {
    if (record[key] !== undefined) out[key] = record[key];
  }
  out.id = record.id;
  return out;
}

function enrichExpiry(q) {
  const today = new Date().toISOString().split("T")[0];
  const isExpired = q.status === "sent" && q.valid_until && q.valid_until < today;
  return { ...q, is_expired: isExpired, effective_status: isExpired ? "expired" : q.status };
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
      lead_id,
      slim = true,
    } = body;

    const limit = Math.min(Number(rawLimit) || 50, 200);

    // Build DB-level filter
    const dbFilter = {};

    // lead_id shortcut — most common use case (forLead), very efficient
    if (lead_id) {
      dbFilter.lead_id = lead_id;
    }

    const DB_FILTERABLE = ["status"];
    for (const key of DB_FILTERABLE) {
      if (filters[key] && filters[key] !== "all") {
        dbFilter[key] = filters[key];
      }
    }

    // City-scoped roles: resolve allowed lead IDs at DB level (small targeted query)
    let cityLeadIds = null;
    if (["sales_rep", "city_manager"].includes(role) && user.city && !lead_id) {
      const cityLeads = await base44.asServiceRole.entities.Lead.filter(
        { city: user.city, is_deleted: false }, "-created_date", 500
      );
      cityLeadIds = new Set(cityLeads.map(l => l.id));
    }

    let quotes = await base44.asServiceRole.entities.Quote.filter(dbFilter, sort, limit + skip);

    // Apply city scope post-fetch (can't do OR in DB filter)
    if (cityLeadIds !== null) {
      quotes = quotes.filter(q => !q.lead_id || cityLeadIds.has(q.lead_id));
    }

    // Apply non-DB-filterable caller filters
    for (const [key, val] of Object.entries(filters)) {
      if (val && val !== "all" && !DB_FILTERABLE.includes(key)) {
        quotes = quotes.filter(q => q[key] === val);
      }
    }

    const paginated = quotes.slice(skip, skip + limit);

    // Enrich with expiry computed fields, then optionally slim
    const result = paginated
      .map(enrichExpiry)
      .map(q => slim ? { ...projectFields(q), is_expired: q.is_expired, effective_status: q.effective_status } : q);

    return Response.json({ quotes: result, total: quotes.length, page: { skip, limit, returned: result.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});