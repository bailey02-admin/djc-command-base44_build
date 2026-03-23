/**
 * createClientUser — Admin-only. Provisions a client portal user for a contact.
 * Never returns 500 for normal edge cases.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function pollForUser(base44, email, attempts = 3, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, delayMs));
    const all = await base44.asServiceRole.entities.User.list().catch(() => []);
    const found = all.find(u => u.email === email);
    if (found) return found;
  }
  return null;
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

  // Fetch contact
  const allContacts = await base44.asServiceRole.entities.Contact.list().catch(() => []);
  const contact = allContacts.find(c => c.id === contact_id);
  if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });
  if (!contact.email) return Response.json({ error: "Contact has no email" }, { status: 422 });

  // Check if a user with this email already exists
  const existingUser = await pollForUser(base44, contact.email, 1, 0);

  if (existingUser) {
    // Update existing user to client role + stamp contact_id
    await base44.asServiceRole.entities.User.update(existingUser.id, {
      role: "client",
      contact_id: contact.id,
    });

    return Response.json({
      ok: true,
      mode: "existing_user_linked",
      email: contact.email,
      contact_id: contact.id,
      role: "client",
      message: `Existing user ${contact.email} linked to this contact as client.`,
    });
  }

  // Invite new user (only "user" role is valid for inviteUser)
  await base44.users.inviteUser(contact.email, "user");

  // Poll for the new user record
  const newUser = await pollForUser(base44, contact.email, 3, 1500);

  if (newUser) {
    await base44.asServiceRole.entities.User.update(newUser.id, {
      role: "client",
      contact_id: contact.id,
    });

    return Response.json({
      ok: true,
      mode: "invited_and_linked",
      email: contact.email,
      contact_id: contact.id,
      role: "client",
      message: `Invitation sent to ${contact.email}. They will receive a login link via email.`,
    });
  }

  // Invite sent but user record not yet queryable
  return Response.json({
    ok: true,
    mode: "invite_pending",
    email: contact.email,
    contact_id: contact.id,
    role: "client",
    message: `Invitation sent to ${contact.email}. Role will be updated shortly.`,
  }, { status: 202 });
});