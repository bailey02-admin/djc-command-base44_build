/**
 * rbacDebug — Admin-only. Returns RBAC identity for self or a lookup email.
 * Lightweight — only hits StaffProfile entity, nothing else.
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
    const targetEmail = lookupEmail || user.email.trim().toLowerCase();

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: targetEmail });
    const staffProfile = profiles?.[0] || null;

    return Response.json({
      lookup_mode: !!lookupEmail,
      lookup_email: lookupEmail || null,
      email: lookupEmail ? null : user.email,
      full_name: lookupEmail ? (staffProfile?.full_name || null) : user.full_name,
      platform_role: lookupEmail ? null : user.role,
      staff_profile_found: !!staffProfile,
      custom_role: staffProfile?.custom_role || null,
      cities: staffProfile?.cities || [],
      is_active: staffProfile ? staffProfile.is_active !== false : (lookupEmail ? null : true),
      invite_status: staffProfile?.invite_status || null,
      staff_profile_id: staffProfile?.id || null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});