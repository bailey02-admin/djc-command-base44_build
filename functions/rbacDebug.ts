/**
 * rbacDebug — Admin-only. Returns RBAC identity for self or a lookup email.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const lookupEmail = body.lookup_email ? body.lookup_email.trim().toLowerCase() : null;

    // If lookup_email provided, return that user's StaffProfile
    if (lookupEmail) {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: lookupEmail });
      const staffProfile = profiles?.[0] || null;
      return Response.json({
        lookup_mode: true,
        lookup_email: lookupEmail,
        staff_profile_found: !!staffProfile,
        custom_role: staffProfile?.custom_role || null,
        cities: staffProfile?.cities || [],
        is_active: staffProfile ? staffProfile.is_active !== false : null,
        invite_status: staffProfile?.invite_status || null,
        staff_profile_id: staffProfile?.id || null,
        full_name: staffProfile?.full_name || null,
      });
    }

    // Default: return caller's own identity
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.trim().toLowerCase() });
    const staffProfile = profiles?.[0] || null;

    return Response.json({
      lookup_mode: false,
      email: user.email,
      full_name: user.full_name,
      platform_role: user.role,
      staff_profile_found: !!staffProfile,
      custom_role: staffProfile?.custom_role || null,
      cities: staffProfile?.cities || [],
      is_active: staffProfile ? staffProfile.is_active !== false : true,
      invite_status: staffProfile?.invite_status || null,
      staff_profile_id: staffProfile?.id || null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});