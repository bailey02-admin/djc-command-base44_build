/**
 * rbacDebug — resolves StaffProfile RBAC identity for the current user.
 * Bootstrap: if no StaffProfile exists for this email, auto-creates one with
 *   custom_role="admin", is_active=true (prevents admin lockout on first load).
 * Lookup mode (lookup_email param): requires caller StaffProfile custom_role=admin.
 * Platform role is NEVER used for access decisions.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lookupEmail = body.lookup_email ? body.lookup_email.trim().toLowerCase() : null;

    const selfEmail = user.email.trim().toLowerCase();

    // Lookup mode: requires caller to be an active admin via StaffProfile
    if (lookupEmail) {
      const callerProfiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: selfEmail });
      const caller = callerProfiles?.[0];
      if (!caller || caller.custom_role !== 'admin' || caller.is_active === false) {
        return Response.json({ error: 'Forbidden: Admin StaffProfile required for email lookup' }, { status: 403 });
      }
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

    // Self-lookup: resolve (and bootstrap if needed)
    let profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: selfEmail });
    let staffProfile = profiles?.[0] || null;

    // Bootstrap: no StaffProfile found — auto-create admin profile to prevent lockout
    if (!staffProfile) {
      staffProfile = await base44.asServiceRole.entities.StaffProfile.create({
        email: selfEmail,
        full_name: user.full_name || selfEmail,
        custom_role: 'admin',
        is_active: true,
        invite_status: 'accepted',
        cities: [],
      });
    }

    // Auto-accept invite_status on first successful login
    if (staffProfile.invite_status === 'invited') {
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
      staff_profile_found: true,
      custom_role: staffProfile?.custom_role || null,
      cities: staffProfile?.cities || [],
      is_active: staffProfile.is_active !== false,
      invite_status: staffProfile?.invite_status || null,
      staff_profile_id: staffProfile?.id || null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});