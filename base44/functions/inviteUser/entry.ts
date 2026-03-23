/**
 * inviteUser — Admin-only endpoint.
 * Generates custom invite token and sends password setup email directly.
 * Also upserts StaffProfile with invite_status='invited'.
 */
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
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'email is required' }, { status: 400 });

    // Generate custom invite token
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Check if user exists in platform
    const users = await base44.asServiceRole.entities.User.list();
    const existingUser = users.find(u => u.email?.toLowerCase() === email);

    // Only create AuthToken if user doesn't exist yet
    if (!existingUser) {
      await base44.asServiceRole.entities.AuthToken.create({
        token_hash: tokenHash,
        type: 'invite',
        user_id: 'pending', // Placeholder until user accepts
        expires_at: expiresAt,
      });
    }

    // Build invite link
    const appUrl = Deno.env.get('APP_URL') || 'https://app.base44.com';
    const inviteLink = `${appUrl}/AcceptInvite?token=${plainToken}`;

    // Send custom invite email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'You\'re invited to DJ Command',
      body: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:24px;font-weight:700;color:#7c3aed;">DJ Command</h1>
  <h2 style="font-size:20px;">Welcome!</h2>
  <p>Hi ${email},</p>
  <p>You've been invited to join DJ Command, the event CRM platform.</p>
  <div style="margin:32px 0;">
    <a href="${inviteLink}" style="background:#7c3aed;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Accept Invitation & Set Password
    </a>
  </div>
  <p style="color:#6b7280;font-size:14px;">This link expires in 7 days.</p>
  <p style="color:#6b7280;font-size:14px;">If you didn't expect this invite, you can safely ignore this email.</p>
</body>
</html>
      `.trim(),
    });

    // Update or create StaffProfile
    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email });
    if (profiles && profiles.length > 0) {
      await base44.asServiceRole.entities.StaffProfile.update(profiles[0].id, {
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      });
    } else {
      // Create placeholder StaffProfile if it doesn't exist
      await base44.asServiceRole.entities.StaffProfile.create({
        email,
        custom_role: 'sales_rep',
        is_active: true,
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      });
    }

    // Audit log
    await base44.asServiceRole.entities.Activity.create({
      type: 'system',
      subject: 'Invite Sent',
      description: `Admin ${actor.email} sent invite to ${email}`,
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