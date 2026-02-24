/**
 * Global search endpoint — searches Leads, Events, Contacts, Venues, DJProfiles.
 * Role/city scoped server-side.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { q = "", limit = 5 } = body;

    if (!q || q.trim().length < 2) return Response.json({ results: {} });

    const role = user.role || "sales_rep";
    const term = q.trim().toLowerCase();

    // Helper: fuzzy text match across multiple string fields
    const matches = (obj, fields) =>
      fields.some(f => obj[f] && String(obj[f]).toLowerCase().includes(term));

    // City scoping: city_manager only sees their city
    let cityFilter = null;
    if (role === "city_manager" && user.city) cityFilter = user.city;

    // Parallel fetches
    const [leads, events, contacts, venues, djs] = await Promise.all([
      // Leads: always through service role but respect city scoping
      base44.asServiceRole.entities.Lead.filter(
        cityFilter ? { is_deleted: false, city: cityFilter } : { is_deleted: false },
        "-created_date", 200
      ).catch(() => []),
      base44.asServiceRole.entities.Event.filter(
        cityFilter ? { is_deleted: false, city: cityFilter } : { is_deleted: false },
        "-event_date", 200
      ).catch(() => []),
      base44.asServiceRole.entities.Contact.list("-created_date", 200).catch(() => []),
      base44.asServiceRole.entities.Venue.list("-created_date", 200).catch(() => []),
      base44.asServiceRole.entities.DJProfile.list("-created_date", 100).catch(() => []),
    ]);

    const matchedLeads = leads
      .filter(l => matches(l, ["client_first_name", "client_last_name", "email", "phone", "city", "venue_name", "partner_first_name"]))
      .slice(0, limit)
      .map(l => ({
        id: l.id, type: "lead",
        title: `${l.client_first_name} ${l.client_last_name}`,
        subtitle: [l.event_type?.replace(/_/g, " "), l.city, l.event_date].filter(Boolean).join(" · "),
        status: l.pipeline_stage,
        meta: l.assigned_rep,
      }));

    const matchedEvents = events
      .filter(e => matches(e, ["event_name", "contact_name", "contact_email", "city", "venue_name", "assigned_dj"]))
      .slice(0, limit)
      .map(e => ({
        id: e.id, type: "event",
        title: e.event_name,
        subtitle: [e.event_date, e.city, e.venue_name].filter(Boolean).join(" · "),
        status: e.status,
        meta: e.assigned_dj,
      }));

    const matchedContacts = contacts
      .filter(c => matches(c, ["first_name", "last_name", "email", "phone", "city"]))
      .slice(0, limit)
      .map(c => ({
        id: c.id, type: "contact",
        title: `${c.first_name} ${c.last_name}`,
        subtitle: [c.role, c.city, c.email].filter(Boolean).join(" · "),
        status: c.preferred_contact_method,
      }));

    const matchedVenues = venues
      .filter(v => matches(v, ["name", "city", "address", "contact_name"]))
      .slice(0, limit)
      .map(v => ({
        id: v.id, type: "venue",
        title: v.name,
        subtitle: [v.city, v.address].filter(Boolean).join(" · "),
      }));

    const matchedDJs = djs
      .filter(d => matches(d, ["name", "email", "city"]))
      .slice(0, limit)
      .map(d => ({
        id: d.id, type: "dj",
        title: d.name,
        subtitle: [d.role, d.city].filter(Boolean).join(" · "),
        status: d.is_active ? "active" : "inactive",
      }));

    return Response.json({
      results: {
        leads: matchedLeads,
        events: matchedEvents,
        contacts: matchedContacts,
        venues: matchedVenues,
        djs: matchedDJs,
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});