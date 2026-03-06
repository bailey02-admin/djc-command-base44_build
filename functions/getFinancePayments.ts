import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "finance", "city_manager"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Get staff profile to check role
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.toLowerCase() });
    const profile = profiles?.[0];
    if (!profile || !ALLOWED_ROLES.includes(profile.custom_role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, city, method, search, limit = 100, skip = 0 } = body;

    // Build filter
    const filter = {};
    if (date_from || date_to) {
      // Filter by paid_date or due_date falling in range — use paid_date primarily
    }

    // Fetch payments — we fetch broadly and filter server-side for search
    let payments = await base44.asServiceRole.entities.Payment.list("-paid_date", 2000);

    // Date filtering on paid_date (fallback to due_date)
    if (date_from) {
      const from = new Date(date_from);
      payments = payments.filter(p => {
        const d = p.paid_date ? new Date(p.paid_date) : (p.due_date ? new Date(p.due_date) : null);
        return d && d >= from;
      });
    }
    if (date_to) {
      const to = new Date(date_to + "T23:59:59");
      payments = payments.filter(p => {
        const d = p.paid_date ? new Date(p.paid_date) : (p.due_date ? new Date(p.due_date) : null);
        return d && d <= to;
      });
    }

    // Method filter
    if (method && method !== "all") {
      payments = payments.filter(p => p.payment_method === method);
    }

    // Search filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      payments = payments.filter(p =>
        p.contact_name?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q) ||
        p.transaction_reference?.toLowerCase().includes(q)
      );
    }

    // City scoping: if city_manager, scope to their cities unless city is specified
    // Enrich with event data for city + event_name
    const eventIds = [...new Set(payments.map(p => p.event_id).filter(Boolean))];
    let eventMap = {};
    if (eventIds.length > 0) {
      // Fetch events in batches (entity filter by array isn't supported, fetch all and map)
      const events = await base44.asServiceRole.entities.Event.list("-event_date", 5000);
      events.forEach(e => { eventMap[e.id] = e; });
    }

    // Enrich payments with event data
    payments = payments.map(p => {
      const ev = eventMap[p.event_id] || {};
      return {
        ...p,
        event_name: ev.event_name || p.event_name || null,
        city: ev.city || p.city || null,
        contact_name: p.contact_name || ev.contact_name || null,
      };
    });

    // City filter (after enrichment)
    if (city && city !== "all") {
      payments = payments.filter(p => p.city === city);
    } else if (profile.custom_role === "city_manager" && profile.cities?.length > 0) {
      // City manager scoped to their cities
      payments = payments.filter(p => !p.city || profile.cities.includes(p.city));
    }

    const total = payments.length;
    const page = payments.slice(skip, skip + limit);

    return Response.json({ payments: page, total, skip, limit });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});