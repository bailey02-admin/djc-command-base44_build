/**
 * validateImpersonationToken — validates a single-use impersonation token.
 * Marks it used on success.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // No auth required — token itself is the credential
  const body = await req.json().catch(() => ({}));
  const { token } = body;
  if (!token) return Response.json({ error: "token required" }, { status: 400 });

  const sessions = await base44.asServiceRole.entities.ImpersonationSession.list().catch(() => []);
  const session = sessions.find(s => s.token === token);

  if (!session) return Response.json({ valid: false, error: "Token not found" }, { status: 404 });
  if (session.used) return Response.json({ valid: false, error: "Token already used" }, { status: 403 });
  if (new Date(session.expires_at) < new Date()) {
    return Response.json({ valid: false, error: "Token expired" }, { status: 403 });
  }

  // Mark as used (single-use)
  await base44.asServiceRole.entities.ImpersonationSession.update(session.id, { used: true });

  // Log the impersonation
  await base44.asServiceRole.entities.Activity.create({
    type: "system",
    subject: `Admin impersonation: ${session.admin_email} viewing as contact ${session.contact_id}`,
    related_type: "contact",
    related_id: session.contact_id,
    is_internal: true,
    performed_by: session.admin_email,
  }).catch(() => {});

  return Response.json({
    valid: true,
    contact_id: session.contact_id,
    admin_email: session.admin_email,
  });
});