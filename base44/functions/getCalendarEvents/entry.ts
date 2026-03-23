import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve StaffProfile for RBAC
    let role = user.role || 'sales_rep';
    let staffProfile = null;
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      staffProfile = profiles?.[0];
      if (staffProfile) {
        if (staffProfile.is_active === false) return Response.json({ error: 'Account deactivated' }, { status: 403 });
        role = staffProfile.custom_role || role;
      }
    } catch (_) {}

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { date_from, date_to, city } = body;

    if (!date_from || !date_to) {
      return Response.json({ error: 'date_from and date_to required' }, { status: 400 });
    }

    // Build query filter
    const filter = {
      event_date: {
        $gte: date_from,
        $lte: date_to
      },
      is_deleted: false
    };

    // City scoping using StaffProfile.cities[] array (canonical per Truth Doc)
    const profileCities = staffProfile?.cities?.length > 0
      ? staffProfile.cities
      : (staffProfile?.default_city ? [staffProfile.default_city] : []);

    if (role === 'dj') {
      // DJs see only their own assigned events
      filter.assigned_dj_id = staffProfile?.id || '__none__';
    } else if (['city_manager', 'sales_rep', 'office_finalizer'].includes(role)) {
      // Single-city: push to DB. Multi-city: filter in-memory below.
      if (profileCities.length === 1) {
        filter.city = profileCities[0];
      }
    }

    // Admin/city_manager explicit city filter override
    if (city && (role === 'admin' || role === 'city_manager')) {
      filter.city = city;
    }

    const allEvents = await base44.asServiceRole.entities.Event.filter(filter, 'event_date', 500);

    // Multi-city filtering for city_manager/sales_rep/office_finalizer
    let events = allEvents;
    if (['city_manager', 'sales_rep', 'office_finalizer'].includes(role) && profileCities.length > 1 && !city) {
      const citySet = new Set(profileCities);
      events = allEvents.filter(e => citySet.has(e.city));
    }

    const minimal = events.map(e => ({
      id: e.id,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      event_name: e.event_name,
      city: e.city,
      status: e.status,
      venue_name: e.venue_name,
      assigned_dj: e.assigned_dj,
      assigned_dj_id: e.assigned_dj_id
    }));

    return Response.json({ events: minimal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});