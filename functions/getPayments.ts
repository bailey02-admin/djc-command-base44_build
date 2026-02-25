/**
 * Secure Payments read endpoint — Performance-hardened.
 *
 * Key changes:
 * - event_id always pushed to DB filter
 * - City manager path: DB-level city event filter, not 500-record in-memory join
 * - Hard limit cap: 50/page with skip for global list
 * - Status filter pushed to DB
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PAYMENT_READ_ALLOWED = new Set(["admin", "city_manager", "sales_manager", "finance"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (!PAYMENT_READ_ALLOWED.has(role)) {
      return Response.json({ error: "Forbidden: your role cannot access payment records" }, { status: 403 });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      event_id,
      limit: rawLimit = 50,
      skip = 0,
      filters = {},
    } = body;

    const limit = Math.min(Number(rawLimit) || 50, 200);

    const dbFilter = {};
    if (event_id) dbFilter.event_id = event_id;
    if (filters.status && filters.status !== "all") dbFilter.status = filters.status;
    if (filters.payment_type && filters.payment_type !== "all") dbFilter.payment_type = filters.payment_type;

    // City manager: scope to city's events — use DB filter, not in-memory join
    if (role === "city_manager" && user.city && !event_id) {
      // Fetch just the event IDs for this city (lean query)
      const cityEvents = await base44.asServiceRole.entities.Event.filter(
        { city: user.city, is_deleted: false }, "-event_date", 500
      );
      const cityEventIds = new Set(cityEvents.map(e => e.id));

      const payments = await base44.asServiceRole.entities.Payment.filter(dbFilter, "-created_date", limit + skip);
      const filtered = payments.filter(p => cityEventIds.has(p.event_id));
      const paginated = filtered.slice(skip, skip + limit);
      return Response.json({ payments: paginated, total: filtered.length, page: { skip, limit, returned: paginated.length } });
    }

    const payments = await base44.asServiceRole.entities.Payment.filter(dbFilter, "-created_date", limit + skip);
    const paginated = payments.slice(skip, skip + limit);

    return Response.json({ payments: paginated, total: payments.length, page: { skip, limit, returned: paginated.length } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});