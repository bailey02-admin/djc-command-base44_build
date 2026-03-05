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
      date_from: { $lte: date_to },
      date_to: { $gte: date_from }
    };

    // Role-based access
    if (role === 'dj') {
      // DJ sees only their own requests
      filter.staff_profile_id = staffProfile?.id;
    } else if (role === 'city_manager' && staffProfile?.default_city) {
      // City manager sees requests in their city
      filter.city = staffProfile.default_city;
    }
    // Admin sees all

    // If city param provided and user is admin/city_manager, apply it
    if (city && (role === 'admin' || role === 'city_manager')) {
      filter.city = city;
    }

    const requests = await base44.asServiceRole.entities.TimeOffRequest.filter(filter, 'date_from', 500);

    return Response.json({ requests });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});