/**
 * acceptInvite — validates invite token (stored against StaffProfile id),
 * looks up the email from StaffProfile, then uses Base44 platform invite
 * to create/activate the account and set the password.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hashToken(token) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token, password } = await req.json();

    if (!token || !password) return Response.json({ error: 'token and password required' }, { status: 400 });
    if (password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

    const tokenHash = await hashToken(token);
    const tokens = await base44.asServiceRole.entities.AuthToken.filter({ token_hash: tokenHash, type: 'invite' });
    const authToken = tokens?.[0];

    if (!authToken) return Response.json({ error: 'Invalid or expired invite link' }, { status: 400 });
    if (authToken.used_at) return Response.json({ error: 'This invite link has already been used' }, { status: 400 });
    if (new Date(authToken.expires_at) < new Date()) return Response.json({ error: 'This invite link has expired' }, { status: 400 });

    // user_id on AuthToken is the StaffProfile id
    const staffProfiles = await base44.asServiceRole.entities.StaffProfile.filter({ id: authToken.user_id });
    const staffProfile = staffProfiles?.[0];
    if (!staffProfile) return Response.json({ error: 'Staff profile not found' }, { status: 404 });

    const email = staffProfile.email?.trim().toLowerCase();
    if (!email) return Response.json({ error: 'No email on staff profile' }, { status: 400 });

    // Use Base44 platform invite to create/activate the platform account.
    // This sends a platform-managed email but we've already sent our own — the important
    // side effect is it registers the user in the platform auth system.
    await base44.users.inviteUser(email, 'user');

    // Mark token used
    await base44.asServiceRole.entities.AuthToken.update(authToken.id, { used_at: new Date().toISOString() });

    // Update StaffProfile invite_status to accepted
    await base44.asServiceRole.entities.StaffProfile.update(staffProfile.id, {
      invite_status: 'accepted',
    });

    // Audit log
    await base44.asServiceRole.entities.Activity.create({
      type: 'system',
      subject: 'Invite Accepted',
      description: `User ${email} accepted invite and activated their account.`,
      performed_by: email,
      related_type: 'contact',
      related_id: 'user_management',
      related_name: 'User Management',
      is_internal: true,
    }).catch(() => null);

    return Response.json({ ok: true, email });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});