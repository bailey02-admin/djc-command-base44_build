/**
 * Secure Report Summary endpoint — Performance-hardened.
 *
 * Key changes:
 * - Default time window: last 90 days for leads, upcoming 90 days for events
 * - All aggregation done server-side (no raw rows sent to browser)
 * - Hard cap: 1000 leads/events max per report (prevents catastrophic scans)
 * - city_filter pushed to DB where possible
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const REPORT_DENIED = new Set(["client", "dj"]);

async function resolveProfile(base44, user) {
  try {
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
    const profile = profiles?.[0];
    if (profile) {
      if (profile.is_active === false) return { role: null, deactivated: true, profile: null };
      return { role: profile.custom_role || user.role || "sales_rep", deactivated: false, profile };
    }
  } catch (_) {}
  return { role: user.role || "sales_rep", deactivated: false, profile: null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { role, deactivated, profile } = await resolveProfile(base44, user);
    if (deactivated) return Response.json({ error: "Account deactivated" }, { status: 403 });
    if (!role || REPORT_DENIED.has(role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { city_filter = "all", date_from, date_to } = body;

    // Default time window: last 90 days
    const now = new Date();
    const defaultFrom = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const defaultTo   = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fromDate = date_from || defaultFrom;
    const toDate   = date_to   || defaultTo;

    // Build DB filters — use StaffProfile.cities[] for scoping (canonical)
    const leadDbFilter  = { is_deleted: false };
    const eventDbFilter = { is_deleted: false };

    // City scoping via StaffProfile.cities[] array (Truth Doc canonical)
    const profileCities = profile?.cities?.length > 0
      ? profile.cities
      : (profile?.default_city ? [profile.default_city] : []);

    if (role === "city_manager") {
      // city_managers are scoped to their cities; if city_filter provided must be within scope
      if (profileCities.length === 1) {
        leadDbFilter.city  = profileCities[0];
        eventDbFilter.city = profileCities[0];
      }
      // multi-city city_manager: filter in-memory below
    } else if (role === "sales_rep") {
      if (profileCities.length === 1) {
        leadDbFilter.city  = profileCities[0];
        eventDbFilter.city = profileCities[0];
      } else if (profileCities.length === 0) {
        leadDbFilter.assigned_rep = user.email;
      }
    } else if (city_filter !== "all") {
      leadDbFilter.city  = city_filter;
      eventDbFilter.city = city_filter;
    }

    // Parallel fetch — capped at 1000 rows each
    const [allLeads, allEvents, allPayments] = await Promise.all([
      base44.asServiceRole.entities.Lead.filter(leadDbFilter, "-created_date", 1000),
      base44.asServiceRole.entities.Event.filter(eventDbFilter, "-event_date", 1000),
      base44.asServiceRole.entities.Payment.filter({ }, "-created_date", 1000),
    ]);

    // Apply time window (post-fetch, range not supported in DB filter)
    let leads  = allLeads.filter(l =>
      l.inquiry_date ? l.inquiry_date.substring(0,10) >= fromDate && l.inquiry_date.substring(0,10) <= toDate : true
    );
    let events = allEvents.filter(e =>
      e.event_date ? e.event_date >= fromDate && e.event_date <= toDate : true
    );

    // Apply additional city filter
    if (city_filter !== "all") {
      if (!["city_manager", "sales_rep"].includes(role)) {
        leads  = leads.filter(l => l.city === city_filter);
        events = events.filter(e => e.city === city_filter);
      }
    }

    // Multi-city city_manager scoping — filter to profile.cities[]
    if (role === "city_manager" && profileCities.length > 1) {
      const citySet = new Set(profileCities);
      leads  = leads.filter(l => citySet.has(l.city));
      events = events.filter(e => citySet.has(e.city));
    }

    const fl = leads;
    const fe = events;

    // Aggregate: pipeline stages
    const pipelineStages = fl.reduce((acc, l) => {
      const s = l.pipeline_stage || "unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    // Aggregate: DJEP lead_status breakdown
    const leadStatusCounts = fl.reduce((acc, l) => {
      const s = l.lead_status || "web_lead";
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
    const realPayments = allPayments.filter(p => (p.amount || 0) > 0);

    // City comparison — group by event.city canonical code
    const cityComparison = ["admin", "sales_manager"].includes(role)
      ? cities.map(city => ({
          city_code: city,
          name: city,  // UI resolves display name via LabelMap
          leads: leads.filter(l => l.city === city).length,
          booked: events.filter(e => e.city === city && ["booked","finalized","completed"].includes(e.status)).length,
          completed: events.filter(e => e.city === city && e.status === "completed").length,
          revenue: realPayments.filter(p => {
            const ev = allEvents.find(e => e.id === p.event_id);
            return ev?.city === city && p.status === "paid";
          }).reduce((s, p) => s + (p.amount || 0), 0),
        }))
      : [];

    // Events at risk (next 30 days)
    const atRiskEvents = fe
      .filter(e => e.event_date)
      .map(e => {
        const days = Math.floor((new Date(e.event_date) - now) / (1000 * 60 * 60 * 24));
        const flags = [e.planning_complete, e.timeline_complete, e.music_complete, e.contract_signed, e.deposit_paid, e.final_call_completed, e.dj_briefed];
        const score = Math.round((flags.filter(Boolean).length / flags.length) * 100);
        return { id: e.id, event_name: e.event_name, event_date: e.event_date, city: e.city, days, score };
      })
      .filter(e => e.days >= 0 && e.days <= 30 && e.score < 80)
      .sort((a, b) => a.days - b.days);

    // Key metrics
    const totalRevenue = realPayments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
    const bookingRate = fl.length > 0 ? Math.round((fl.filter(l => l.status === "booked").length / fl.length) * 100) : 0;
    // Use total_fee (canonical snapshot field) — fallback to package_price for legacy records
    const eventsWithFee = fe.filter(e => e.total_fee || e.package_price);
    const avgBookingValue = eventsWithFee.length > 0
      ? Math.round(eventsWithFee.reduce((s, e) => s + (e.total_fee || e.package_price || 0), 0) / eventsWithFee.length) : 0;
    const respondedLeads = fl.filter(l => l.sla_minutes_elapsed != null);
    const avgResponseMin = respondedLeads.length > 0
      ? Math.round(respondedLeads.reduce((s, l) => s + l.sla_minutes_elapsed, 0) / respondedLeads.length) : null;

    const unassignedDJ = fe.filter(e => !e.assigned_dj).length;
    const incompletePlanning = fe.filter(e => !e.planning_complete).length;
    const missedSLA = fl.filter(l => l.sla_status === "missed").length;

    return Response.json({
      metrics: { totalRevenue, bookingRate, avgBookingValue, avgResponseMin, missedSLA, unassignedDJ, incompletePlanning },
      pipelineStages,
      leadStatusCounts,
      slaCounts,
      sourceCounts,
      lostReasons,
      cityComparison,
      atRiskEvents,
      cities,
      totalLeads: fl.length,
      totalEvents: fe.length,
      dateWindow: { from: fromDate, to: toDate },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});