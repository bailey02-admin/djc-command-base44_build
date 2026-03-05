import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve caller's effective role from StaffProfile
    const callerProfiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.trim().toLowerCase() });
    const callerRole = callerProfiles?.[0]?.custom_role || user.role || 'sales_rep';

    // admin platform role always has access; otherwise check custom_role
    const hasAccess = user.role === 'admin' ||
      ['admin', 'city_manager', 'sales_manager', 'office_finalizer'].includes(callerRole);
    if (!hasAccess) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { filters = {}, sort = '-created_date', limit = 50, skip = 0, id } = body;

    // Single profile lookup
    if (id) {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ id });
      const profile = profiles?.[0] || null;
      return Response.json({ user: profile });
    }

    // List all profiles
    let profiles = await base44.asServiceRole.entities.StaffProfile.list(sort, 500);

    // Apply filters
    if (filters.search) {
      const q = filters.search.toLowerCase();
      profiles = profiles.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      );
    }
    if (filters.role) profiles = profiles.filter(p => p.custom_role === filters.role);
    if (filters.city) profiles = profiles.filter(p => (p.cities || []).includes(filters.city) || p.default_city === filters.city);
    if (filters.is_active !== undefined && filters.is_active !== '') {
      const active = filters.is_active === true || filters.is_active === 'true';
      profiles = profiles.filter(p => (p.is_active !== false) === active);
    }

    const total = profiles.length;
    const users = profiles.slice(skip, skip + limit);
    return Response.json({ users, total, page: { returned: users.length, skip, limit } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});