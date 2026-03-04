import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    let targetUser;

    if (body.user_id) {
      const users = await base44.asServiceRole.entities.User.list();
      targetUser = users.find(u => u.id === body.user_id);
      if (!targetUser) return Response.json({ error: 'User not found' }, { status: 404 });
    } else {
      // Create user inline
      if (!body.email || !body.role) return Response.json({ error: 'email and role required' }, { status: 400 });
      targetUser = await base44.asServiceRole.entities.User.create({
        email: body.email,
        full_name: body.full_name || '',
        role: body.role,
        cities: body.cities || [],
        default_city: body.default_city || null,
        is_active: true,
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      });
    }

    // Invalidate old invite tokens for this user
    const oldTokens = await base44.asServiceRole.entities.AuthToken.filter({ user_id: targetUser.id, type: 'invite' });
    for (const t of oldTokens) {
      if (!t.used_at) {
        await base44.asServiceRole.entities.AuthToken.update(t.id, { used_at: new Date().toISOString() });
      }
    }

    // Generate new token
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.AuthToken.create({
      token_hash: tokenHash,
      type: 'invite',
      user_id: targetUser.id,
      expires_at: expiresAt,
    });

    await base44.asServiceRole.entities.User.update(targetUser.id, {
      invited_at: new Date().toISOString(),
      invite_status: 'invited',
    });

    // Build invite link — use app URL via env or fallback
    const appUrl = Deno.env.get('APP_URL') || 'https://app.base44.com';
    const inviteLink = `${appUrl}/AcceptInvite?token=${plainToken}`;

    // Send invite email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: targetUser.email,
      subject: "You've been invited to DJ Command",
      body: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <div style="margin-bottom:24px;">
    <h1 style="font-size:24px;font-weight:700;color:#7c3aed;">DJ Command</h1>
  </div>
  <h2 style="font-size:20px;">You've been invited!</h2>
  <p>Hi ${targetUser.full_name || targetUser.email},</p>
  <p>You've been invited to join <strong>DJ Command</strong> as <strong>${targetUser.role}</strong>.</p>
  <p>Click the button below to set your password and get started:</p>
  <div style="margin:32px 0;">
    <a href="${inviteLink}" style="background:#7c3aed;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Set Your Password
    </a>
  </div>
  <p style="color:#6b7280;font-size:14px;">This invite link expires in 48 hours.</p>
  <p style="color:#6b7280;font-size:14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
</body>
</html>
      `.trim(),
    });

    return Response.json({ ok: true, user_id: targetUser.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});