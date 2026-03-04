import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'city_manager', 'sales_manager', 'office_finalizer'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { filters = {}, sort = '-created_date', limit = 50, skip = 0 } = await req.json().catch(() => ({}));

    let allUsers = await base44.asServiceRole.entities.User.list(sort, 500);

    // Apply filters
    if (filters.search) {
      const q = filters.search.toLowerCase();
      allUsers = allUsers.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }
    if (filters.role) allUsers = allUsers.filter(u => u.role === filters.role);
    if (filters.city) allUsers = allUsers.filter(u => (u.cities || []).includes(filters.city) || u.default_city === filters.city);
    if (filters.is_active !== undefined && filters.is_active !== '') {
      const active = filters.is_active === true || filters.is_active === 'true';
      allUsers = allUsers.filter(u => (u.is_active !== false) === active);
    }

    const total = allUsers.length;
    const users = allUsers.slice(skip, skip + limit);
    return Response.json({ users, total, page: { returned: users.length, skip, limit } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});