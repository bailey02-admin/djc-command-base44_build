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
    const { email } = await req.json();

    // Always return ok to prevent user enumeration
    if (!email) return Response.json({ ok: true });

    const users = await base44.asServiceRole.entities.User.list();
    const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) return Response.json({ ok: true });

    // Invalidate old reset tokens
    const oldTokens = await base44.asServiceRole.entities.AuthToken.filter({ user_id: targetUser.id, type: 'password_reset' });
    for (const t of oldTokens) {
      if (!t.used_at) {
        await base44.asServiceRole.entities.AuthToken.update(t.id, { used_at: new Date().toISOString() });
      }
    }

    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await base44.asServiceRole.entities.AuthToken.create({
      token_hash: tokenHash,
      type: 'password_reset',
      user_id: targetUser.id,
      expires_at: expiresAt,
    });

    const appUrl = Deno.env.get('APP_URL') || 'https://app.base44.com';
    const resetLink = `${appUrl}/ResetPassword?token=${plainToken}`;

    // Audit log — reset requested
    await base44.asServiceRole.entities.Activity.create({
      type: 'system',
      subject: 'Password Reset Requested',
      description: `Password reset requested for ${targetUser.email}.`,
      performed_by: targetUser.email,
      related_type: 'contact',
      related_id: 'user_management',
      related_name: 'User Management',
      is_internal: true,
    }).catch(() => null);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: targetUser.email,
      subject: 'DJ Command — Password Reset',
      body: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:24px;font-weight:700;color:#7c3aed;">DJ Command</h1>
  <h2 style="font-size:20px;">Reset your password</h2>
  <p>Hi ${targetUser.full_name || targetUser.email},</p>
  <p>We received a request to reset your password. Click below to set a new password:</p>
  <div style="margin:32px 0;">
    <a href="${resetLink}" style="background:#7c3aed;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
      Reset Password
    </a>
  </div>
  <p style="color:#6b7280;font-size:14px;">This link expires in 1 hour.</p>
  <p style="color:#6b7280;font-size:14px;">If you didn't request a reset, you can safely ignore this email.</p>
</body>
</html>
      `.trim(),
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});