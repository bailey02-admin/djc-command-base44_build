/**
 * rbacDebug — Admin-only endpoint that returns the caller's resolved RBAC identity.
 * Returns: { email, platform_role, staffProfile, custom_role, cities, is_active }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    let staffProfile = null;
    try {
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email });
      staffProfile = profiles?.[0] || null;
    } catch (_) { /* StaffProfile unavailable */ }

    return Response.json({
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