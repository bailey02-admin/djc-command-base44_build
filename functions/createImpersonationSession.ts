/**
 * createImpersonationSession — Admin / City Manager / Office Finalizer only.
 * Accepts either contact_id or event_id (preferred).
 * Creates a short-lived (10 min), single-use impersonation token.
 * Logs the action as an Activity for audit trail.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = new Set(["admin", "city_manager", "office_finalizer"]);

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden: insufficient role" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { contact_id, event_id } = body;

    if (!contact_id && !event_id) {
      return Response.json({ error: "contact_id or event_id required" }, { status: 400 });
    }

    let resolvedContactId = contact_id;
    let resolvedEventId = event_id;
    let contactEmail = "";

    // If event_id provided, look up contact from event
    if (event_id && !contact_id) {
      const events = await base44.asServiceRole.entities.Event.filter({ id: event_id }, "-created_date", 1);
      const evt = events[0];
      if (!evt || evt.is_deleted) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      if (!evt.contact_id) {
        return Response.json({ error: "Event has no linked contact" }, { status: 400 });
      }
      resolvedContactId = evt.contact_id;
    }

    // Verify contact exists — use filter by id (not list-all)
    const contacts = await base44.asServiceRole.entities.Contact.filter({ id: resolvedContactId }, "-created_date", 1);
    const contact = contacts[0];
    if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });
    contactEmail = contact.email || "";

    // If we only had contact_id, try to find an associated event for the redirect
    if (!resolvedEventId && contact_id) {
      const events = await base44.asServiceRole.entities.Event.filter(
        { contact_id: resolvedContactId, is_deleted: false }, "-event_date", 1
      );
      resolvedEventId = events[0]?.id || null;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.ImpersonationSession.create({
      token,
      admin_user_id: user.id,
      admin_email: user.email,
      contact_id: resolvedContactId,
      contact_email: contactEmail,
      expires_at: expiresAt,
      used: false,
    });

    // Audit log
    await base44.asServiceRole.entities.Activity.create({
      type: "system",
      subject: `Impersonation started: ${user.email} (${user.role}) viewing as ${contactEmail}${resolvedEventId ? ` for event ${resolvedEventId}` : ""}`,
      related_type: "contact",
      related_id: resolvedContactId,
      related_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim(),
      is_internal: true,
      performed_by: user.email,
    }).catch(() => {});

    // Build redirect URL — deep-link to the event if we have one
    const redirectUrl = resolvedEventId
      ? `/ClientPortal?impersonation_token=${token}&event_id=${resolvedEventId}&view=planning`
      : `/ClientPortal?impersonation_token=${token}`;

    return Response.json({ ok: true, redirect_url: redirectUrl, expires_at: expiresAt });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});