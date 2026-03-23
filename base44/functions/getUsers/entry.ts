import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // RBAC: StaffProfile custom_role ONLY — no platform role check
    const email = user.email.trim().toLowerCase();
    const callerProfiles = await base44.asServiceRole.entities.StaffProfile.filter({ email });
    const caller = callerProfiles?.[0];

    if (!caller || caller.custom_role !== 'admin' || caller.is_active === false) {
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

    // List all StaffProfiles (and any invited users without profiles yet)
    let profiles = await base44.asServiceRole.entities.StaffProfile.list(sort, 500);
    
    // Also check for invited users in platform User entity that don't have StaffProfile yet
    const allUsers = await base44.asServiceRole.entities.User.list();
    const profileEmails = new Set(profiles.map(p => p.email?.toLowerCase()));
    const missingProfiles = allUsers
      .filter(u => u.email && !profileEmails.has(u.email.toLowerCase()))
      .map(u => ({
        email: u.email,
        full_name: u.full_name,
        custom_role: 'sales_rep',
        is_active: true,
        invite_status: 'accepted',
        cities: [],
      }));
    profiles = [...profiles, ...missingProfiles];

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