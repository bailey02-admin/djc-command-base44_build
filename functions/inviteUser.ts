/**
 * inviteUser — Admin-only endpoint.
 * Uses Base44's native platform invite (handles password setup email natively).
 * Also upserts StaffProfile with invite_status='invited'.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'email is required' }, { status: 400 });

    // Send platform-native invite — this handles password setup email
    await base44.users.inviteUser(email, 'user');

    // Update StaffProfile invite_status if profile exists
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email });
    if (profiles && profiles.length > 0) {
      await base44.asServiceRole.entities.StaffProfile.update(profiles[0].id, {
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      });
    }

    // Audit log
    await base44.asServiceRole.entities.Activity.create({
      type: 'system',
      subject: 'Invite Sent',
      description: `Admin ${actor.email} sent platform invite to ${email}`,
      performed_by: actor.email,
      related_type: 'contact',
      related_id: 'user_management',
      related_name: 'User Management',
      is_internal: true,
    }).catch(() => null);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});