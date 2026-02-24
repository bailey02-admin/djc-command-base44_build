/**
 * Secure Payments read endpoint.
 * Only admin, city_manager, sales_manager, finance can read payments.
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
    const { event_id, limit = 100 } = body;

    let payments;
    if (event_id) {
      payments = await base44.asServiceRole.entities.Payment.filter({ event_id }, "-created_date", limit);
    } else {
      payments = await base44.asServiceRole.entities.Payment.list("-created_date", limit);
    }

    // City manager: scope to their city's events
    if (role === "city_manager" && user.city && !event_id) {
      const events = await base44.asServiceRole.entities.Event.filter({ city: user.city }, "-event_date", 500);
      const eventIds = new Set(events.map(e => e.id));
      payments = payments.filter(p => eventIds.has(p.event_id));
    }

    return Response.json({ payments, total: payments.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});