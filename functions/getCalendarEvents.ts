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

    // Role-based city scoping
    if (role === 'city_manager' && staffProfile?.default_city) {
      filter.city = staffProfile.default_city;
    } else if (role === 'dj') {
      filter.assigned_dj_id = staffProfile?.id;
    } else if (role === 'sales_rep' && staffProfile?.default_city) {
      filter.city = staffProfile.default_city;
    } else if (role === 'office_finalizer' && staffProfile?.default_city) {
      filter.city = staffProfile.default_city;
    }

    // If city param provided and user is admin/city_manager, apply it
    if (city && (role === 'admin' || role === 'city_manager')) {
      filter.city = city;
    }

    const events = await base44.asServiceRole.entities.Event.filter(filter, 'event_date', 500);

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