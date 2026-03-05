import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ['admin', 'city_manager', 'office_finalizer'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve role from StaffProfile
    let role = user.role || 'sales_rep';
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      const profile = profiles?.[0];
      if (profile) {
        if (profile.is_active === false) return Response.json({ error: 'Account deactivated' }, { status: 403 });
        role = profile.custom_role || role;
      }
    } catch (_) {}
    if (!ALLOWED_ROLES.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { event_id, assigned_dj_id, assigned_mc_id } = await req.json();
    if (!event_id) return Response.json({ error: 'event_id required' }, { status: 400 });

    const updates = {};
    const activityParts = [];

    if (assigned_dj_id !== undefined) {
      if (assigned_dj_id === null || assigned_dj_id === '') {
        updates.assigned_dj_id = null;
        updates.assigned_dj = null;
        activityParts.push('Removed DJ assignment');
      } else {
        const allUsers = await base44.asServiceRole.entities.User.list();
        const djUser = allUsers.find(u => u.id === assigned_dj_id);
        if (!djUser) return Response.json({ error: 'DJ user not found' }, { status: 404 });
        updates.assigned_dj_id = djUser.id;
        updates.assigned_dj = djUser.full_name || djUser.email;
        activityParts.push(`Assigned DJ: ${updates.assigned_dj}`);
      }
    }

    if (assigned_mc_id !== undefined) {
      if (assigned_mc_id === null || assigned_mc_id === '') {
        updates.assigned_mc_id = null;
        updates.assigned_mc = null;
        activityParts.push('Removed MC assignment');
      } else {
        const allUsers = await base44.asServiceRole.entities.User.list();
        const mcUser = allUsers.find(u => u.id === assigned_mc_id);
        if (!mcUser) return Response.json({ error: 'MC user not found' }, { status: 404 });
        updates.assigned_mc_id = mcUser.id;
        updates.assigned_mc = mcUser.full_name || mcUser.email;
        activityParts.push(`Assigned MC: ${updates.assigned_mc}`);
      }
    }

    const event = await base44.asServiceRole.entities.Event.update(event_id, updates);

    if (activityParts.length > 0) {
      await base44.asServiceRole.entities.Activity.create({
        type: 'assignment',
        subject: activityParts.join(' / '),
        related_type: 'event',
        related_id: event_id,
        related_name: event.event_name,
        performed_by: user.email,
        is_internal: true,
      });
    }

    return Response.json({ event });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});