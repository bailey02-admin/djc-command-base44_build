/**
 * createImpersonationSession — Admin-only.
 * Creates a short-lived (10 min), single-use impersonation token for a contact.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { contact_id } = body;
  if (!contact_id) return Response.json({ error: "contact_id required" }, { status: 400 });

  // Verify contact exists
  const contacts = await base44.asServiceRole.entities.Contact.list().catch(() => []);
  const contact = contacts.find(c => c.id === contact_id);
  if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Store session record
  await base44.asServiceRole.entities.ImpersonationSession.create({
    token,
    admin_user_id: user.id,
    admin_email: user.email,
    contact_id: contact.id,
    contact_email: contact.email || "",
    expires_at: expiresAt,
    used: false,
  });

  const redirectUrl = `/ClientPortal?impersonation_token=${token}`;

  return Response.json({ ok: true, redirect_url: redirectUrl, expires_at: expiresAt });
});