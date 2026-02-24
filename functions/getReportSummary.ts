/**
 * Secure Report Summary endpoint.
 * Returns role-scoped aggregates only — no raw entity reads from browser.
 * DJs: blocked. Clients: blocked.
 * City managers: city-scoped. Admins/managers: full.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const REPORT_DENIED = new Set(["client", "dj"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const role = user.role || "sales_rep";
    if (REPORT_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { city_filter = "all" } = body;

    // Parallel fetch
    const [allLeads, allEvents, allPayments] = await Promise.all([
      base44.asServiceRole.entities.Lead.list("-created_date", 500),
      base44.asServiceRole.entities.Event.list("-event_date", 500),
      base44.asServiceRole.entities.Payment.list("-created_date", 500),
    ]);

    // Apply role scoping
    let leads = allLeads.filter(l => !l.is_deleted);
    let events = allEvents.filter(e => !e.is_deleted);

    if (role === "city_manager" && user.city) {
      leads = leads.filter(l => l.city === user.city);
      events = events.filter(e => e.city === user.city);
    } else if (role === "sales_rep") {
      leads = leads.filter(l => l.assigned_rep === user.email || (user.city && l.city === user.city));
      events = events.filter(e => user.city ? e.city === user.city : true);
    }

    // Apply optional city filter from UI
    const fl = city_filter === "all" ? leads : leads.filter(l => l.city === city_filter);
    const fe = city_filter === "all" ? events : events.filter(e => e.city === city_filter);

    // Aggregate: pipeline stages
    const pipelineStages = fl.reduce((acc, l) => {
      const s = l.pipeline_stage || "unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    // SLA breakdown
    const slaCounts = fl.reduce((acc, l) => {
      const s = l.sla_status || "on_time";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    // Lead source breakdown
    const sourceCounts = fl.reduce((acc, l) => {
      const src = l.lead_source || "unknown";
      if (!acc[src]) acc[src] = { total: 0, booked: 0 };
      acc[src].total++;
      if (l.status === "booked") acc[src].booked++;
      return acc;
    }, {});

    // Lost reasons
    const lostReasons = fl.filter(l => l.status === "lost" && l.lost_reason).reduce((acc, l) => {
      acc[l.lost_reason] = (acc[l.lost_reason] || 0) + 1;
      return acc;
    }, {});

    // City comparison (admin/manager only)
    const cities = [...new Set([...leads.map(l => l.city), ...events.map(e => e.city)].filter(Boolean))];
    const cityComparison = ["admin", "sales_manager"].includes(role)
      ? cities.map(city => ({
          name: city,
          leads: leads.filter(l => l.city === city).length,
          booked: leads.filter(l => l.city === city && l.status === "booked").length,
          revenue: allPayments.filter(p => {
            const ev = events.find(e => e.id === p.event_id);
            return ev?.city === city && p.status === "paid";
          }).reduce((s, p) => s + (p.amount || 0), 0),
        }))
      : [];

    // Events at risk
    const now = new Date();
    const atRiskEvents = fe
      .filter(e => e.event_date)
      .map(e => {
        const days = Math.floor((new Date(e.event_date) - now) / (1000 * 60 * 60 * 24));
        // readiness: count bool flags
        const flags = [e.planning_complete, e.timeline_complete, e.music_complete, e.contract_signed, e.deposit_paid, e.final_call_completed, e.dj_briefed];
        const score = Math.round((flags.filter(Boolean).length / flags.length) * 100);
        return { id: e.id, event_name: e.event_name, event_date: e.event_date, city: e.city, days, score };
      })
      .filter(e => e.days >= 0 && e.days <= 30 && e.score < 80)
      .sort((a, b) => a.days - b.days);

    // Key metrics
    const totalRevenue = allPayments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
    const bookingRate = fl.length > 0 ? Math.round((fl.filter(l => l.status === "booked").length / fl.length) * 100) : 0;
    const avgBookingValue = fe.filter(e => e.package_price).length > 0
      ? Math.round(fe.filter(e => e.package_price).reduce((s, e) => s + e.package_price, 0) / fe.filter(e => e.package_price).length) : 0;
    const respondedLeads = fl.filter(l => l.sla_minutes_elapsed != null);
    const avgResponseMin = respondedLeads.length > 0
      ? Math.round(respondedLeads.reduce((s, l) => s + l.sla_minutes_elapsed, 0) / respondedLeads.length) : null;

    const unassignedDJ = fe.filter(e => !e.assigned_dj).length;
    const incompletePlanning = fe.filter(e => !e.planning_complete).length;
    const missedSLA = fl.filter(l => l.sla_status === "missed").length;

    return Response.json({
      metrics: { totalRevenue, bookingRate, avgBookingValue, avgResponseMin, missedSLA, unassignedDJ, incompletePlanning },
      pipelineStages,
      slaCounts,
      sourceCounts,
      lostReasons,
      cityComparison,
      atRiskEvents,
      cities,
      totalLeads: fl.length,
      totalEvents: fe.length,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});