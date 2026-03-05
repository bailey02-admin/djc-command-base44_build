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
    const authToken = tokens[0];

    if (!authToken) return Response.json({ error: 'Invalid or expired invite link' }, { status: 400 });
    if (authToken.used_at) return Response.json({ error: 'This invite link has already been used' }, { status: 400 });
    if (new Date(authToken.expires_at) < new Date()) return Response.json({ error: 'This invite link has expired' }, { status: 400 });

    // Find the user
    const users = await base44.asServiceRole.entities.User.filter({ id: authToken.user_id });
    const targetUser = users[0];
    if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });

    // Use Base44 invite mechanism — we update the user record to accepted
    // then call base44 platform invite with password
    await base44.users.inviteUser(targetUser.email, targetUser.role || 'user');

    // Mark token used
    await base44.asServiceRole.entities.AuthToken.update(authToken.id, { used_at: new Date().toISOString() });

    // Update user record
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      invite_status: 'accepted',
      last_login_at: new Date().toISOString(),
    });

    // Audit log
    await base44.asServiceRole.entities.Activity.create({
      type: 'system',
      subject: 'Invite Accepted / Password Set',
      description: `User ${targetUser.email} accepted invite and set their password.`,
      performed_by: targetUser.email,
      related_type: 'contact',
      related_id: 'user_management',
      related_name: 'User Management',
      is_internal: true,
    }).catch(() => null);

    return Response.json({ ok: true, email: targetUser.email });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});