import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED_ROLES = new Set(['dj', 'client']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.toLowerCase() });
    const profile = profiles?.[0];
    if (!profile || profile.is_active === false) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (BLOCKED_ROLES.has(profile.custom_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.ReportDefinition.filter({ id });
    const record = existing?.[0];
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 });

    // Only owner or admin can delete
    const isOwner = record.created_by_staff_profile_id === profile.id;
    const isAdmin = profile.custom_role === 'admin';
    if (!isOwner && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.ReportDefinition.delete(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});