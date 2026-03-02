/**
 * createClientUser — Admin-only function to provision a client portal user.
 *
 * Fetches the Contact by contact_id, then invites a User with:
 *   email = contact.email
 *   role  = "client"
 *   contact_id = contact.id
 *
 * Returns temporary password for the admin to share.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { contact_id } = body;
    if (!contact_id) return Response.json({ error: "contact_id required" }, { status: 400 });

    // Fetch contact
    const contactRows = await base44.asServiceRole.entities.Contact.list();
    const contact = contactRows.find(c => c.id === contact_id);
    if (!contact) return Response.json({ error: "Contact not found" }, { status: 404 });
    if (!contact.email) return Response.json({ error: "Contact has no email address" }, { status: 422 });

    // Check if a client user already exists for this contact
    const allUsers = await base44.asServiceRole.entities.User.list().catch(() => []);
    const existingUsers = allUsers.filter(u => u.contact_id === contact.id);
    if (existingUsers.length > 0) {
      return Response.json({
        error: "A client user already exists for this contact",
        existing_email: existingUsers[0].email,
      }, { status: 409 });
    }

    // Invite/create the user via base44
    const tempPassword = generateTempPassword();

    // Use the users invite API
    await base44.users.inviteUser(contact.email, "client");

    // Stamp contact_id onto the new user record once it's created
    // We'll store contact_id directly on the user via updateMe-equivalent
    // Poll/find the new user record and update it
    // Give a brief moment for the invite to propagate
    await new Promise(r => setTimeout(r, 1500));

    const newUserRows = await base44.asServiceRole.entities.User.filter({ email: contact.email }).catch(() => []);
    if (newUserRows[0]) {
      await base44.asServiceRole.entities.User.update(newUserRows[0].id, { contact_id: contact.id });
    }

    return Response.json({
      success: true,
      email: contact.email,
      contact_name: `${contact.first_name} ${contact.last_name || ""}`.trim(),
      contact_id: contact.id,
      message: `Client portal user created for ${contact.email}. They will receive a login invitation via email.`,
      temp_note: "Base44 sends an invitation email — the client sets their own password via the link.",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});