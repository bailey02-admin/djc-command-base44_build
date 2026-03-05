/**
 * rbacDebug — Admin-only. Returns RBAC identity for self or a lookup email.
 * Also supports auto-accepting invite_status for first-login provisioning.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lookupEmail = body.lookup_email ? body.lookup_email.trim().toLowerCase() : null;

    // Lookup mode: admin-only
    if (lookupEmail) {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only for email lookup' }, { status: 403 });
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: lookupEmail });
      const staffProfile = profiles?.[0] || null;
      return Response.json({
        lookup_mode: true,
        lookup_email: lookupEmail,
        staff_profile_found: !!staffProfile,
        full_name: staffProfile?.full_name || null,
        custom_role: staffProfile?.custom_role || null,
        cities: staffProfile?.cities || [],
        is_active: staffProfile ? staffProfile.is_active !== false : null,
        invite_status: staffProfile?.invite_status || null,
        staff_profile_id: staffProfile?.id || null,
      });
    }

    // Self-lookup mode: any authenticated user
    const email = user.email.trim().toLowerCase();
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email });
    const staffProfile = profiles?.[0] || null;

    // Auto-accept invite_status on first successful login
    if (staffProfile && staffProfile.invite_status === 'invited') {
      await base44.asServiceRole.entities.StaffProfile.update(staffProfile.id, {
        invite_status: 'accepted',
      }).catch(() => null);
      staffProfile.invite_status = 'accepted';
    }

    return Response.json({
      lookup_mode: false,
      lookup_email: null,
      email: user.email,
      full_name: staffProfile?.full_name || user.full_name || null,
      platform_role: user.role,
      staff_profile_found: !!staffProfile,
      custom_role: staffProfile?.custom_role || null,
      cities: staffProfile?.cities || [],
      is_active: staffProfile ? staffProfile.is_active !== false : false,
      invite_status: staffProfile?.invite_status || null,
      staff_profile_id: staffProfile?.id || null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});