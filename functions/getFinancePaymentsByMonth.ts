import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ["admin", "finance", "city_manager"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.toLowerCase() });
    const profile = profiles?.[0];
    if (!profile || !ALLOWED_ROLES.includes(profile.custom_role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { date_from, date_to, city } = body;

    // Fetch all payments in range
    let payments = await base44.asServiceRole.entities.Payment.list("-paid_date", 5000);

    if (date_from) {
      const from = new Date(date_from);
      payments = payments.filter(p => {
        const d = p.paid_date ? new Date(p.paid_date) : null;
        return d && d >= from;
      });
    }
    if (date_to) {
      const to = new Date(date_to + "T23:59:59");
      payments = payments.filter(p => {
        const d = p.paid_date ? new Date(p.paid_date) : null;
        return d && d <= to;
      });
    }

    // Only include paid payments for monthly rollup
    payments = payments.filter(p => p.status === "paid" && p.paid_date);

    // Enrich with event city info
    if (city && city !== "all") {
      const events = await base44.asServiceRole.entities.Event.list("-event_date", 5000);
      const eventMap = {};
      events.forEach(e => { eventMap[e.id] = e; });
      payments = payments.filter(p => {
        const ev = eventMap[p.event_id] || {};
        return ev.city === city;
      });
    } else if (profile.custom_role === "city_manager" && profile.cities?.length > 0) {
      const events = await base44.asServiceRole.entities.Event.list("-event_date", 5000);
      const eventMap = {};
      events.forEach(e => { eventMap[e.id] = e; });
      payments = payments.filter(p => {
        const ev = eventMap[p.event_id] || {};
        return !ev.city || profile.cities.includes(ev.city);
      });
    }

    // Group by month YYYY-MM
    const monthMap = {};
    for (const p of payments) {
      const d = new Date(p.paid_date);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[month]) monthMap[month] = { month, payment_count: 0, total_amount: 0 };
      monthMap[month].payment_count += 1;
      monthMap[month].total_amount += p.amount || 0;
    }

    const months = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));

    return Response.json({ months });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});