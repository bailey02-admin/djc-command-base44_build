/**
 * mutateUser — Admin-only. Manages StaffProfile CRUD + invites.
 * All invites now use Base44's native platform invite (handles password setup).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function auditLog(base44, actor, subject, description) {
  await base44.asServiceRole.entities.Activity.create({
    type: 'system',
    subject,
    description,
    performed_by: actor?.email || 'system',
    related_type: 'contact',
    related_id: 'user_management',
    related_name: 'User Management',
    is_internal: true,
  }).catch(() => null);
}

async function upsertProfile(base44, email, data) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await base44.asServiceRole.entities.StaffProfile.filter({ email: normalizedEmail });
  if (existing && existing.length > 0) {
    return base44.asServiceRole.entities.StaffProfile.update(existing[0].id, data);
  }
  return base44.asServiceRole.entities.StaffProfile.create({ email: normalizedEmail, ...data });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const { action, id, data = {} } = await req.json();

    // ── CREATE (StaffProfile only, no invite) ──────────────────────────────
    if (action === 'create') {
      if (!data.custom_role) return Response.json({ error: 'custom_role is required' }, { status: 400 });
      if (data.custom_role !== 'client' && !data.email) return Response.json({ error: 'email is required for staff roles' }, { status: 400 });
      if (data.custom_role === 'client' && !data.contact_id) return Response.json({ error: 'contact_id is required for client role' }, { status: 400 });

      const email = (data.email || '').trim().toLowerCase();
      const profileData = {
        full_name: data.full_name || '',
        phone: data.phone || '',
        custom_role: data.custom_role,
        cities: data.cities || [],
        default_city: data.default_city || '',
        is_active: data.is_active !== false,
        invite_status: 'not_invited',
        contact_id: data.contact_id || '',
        notes: data.notes || '',
      };

      const profile = await upsertProfile(base44, email, profileData);
      await auditLog(base44, actor, 'StaffProfile Created',
        `Admin ${actor.email} created profile ${email} with role=${data.custom_role}`);
      return Response.json({ user: profile });
    }

    // ── CREATE + INVITE (StaffProfile + platform invite) ──────────────────
    if (action === 'create_and_invite') {
      if (!data.email) return Response.json({ error: 'email is required' }, { status: 400 });
      if (!data.custom_role) return Response.json({ error: 'custom_role is required' }, { status: 400 });

      const email = data.email.trim().toLowerCase();

      // 1. Upsert StaffProfile
      const profileData = {
        full_name: data.full_name || '',
        phone: data.phone || '',
        custom_role: data.custom_role,
        cities: data.cities || [],
        default_city: data.default_city || '',
        is_active: true,
        contact_id: data.contact_id || '',
        notes: data.notes || '',
        invite_status: 'not_invited',
      };
      const profile = await upsertProfile(base44, email, profileData);

      // 2. Send platform-native invite (handles password setup email)
      await base44.users.inviteUser(email, 'user');

      // 3. Mark as invited
      const invited = await base44.asServiceRole.entities.StaffProfile.update(profile.id, {
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      });

      await auditLog(base44, actor, 'StaffProfile Invited',
        `Admin ${actor.email} created + invited ${email} with role=${data.custom_role}`);
      return Response.json({ user: invited });
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────
    if (action === 'update') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const old = await base44.asServiceRole.entities.StaffProfile.filter({ id }).then(r => r[0]).catch(() => null);

      const updateData = { ...data };
      if (updateData.role && !updateData.custom_role) {
        updateData.custom_role = updateData.role;
        delete updateData.role;
      }
      // Normalize email if being updated
      if (updateData.email) updateData.email = updateData.email.trim().toLowerCase();

      const updated = await base44.asServiceRole.entities.StaffProfile.update(id, updateData);

      const logs = [];
      if (old && updateData.custom_role && old.custom_role !== updateData.custom_role)
        logs.push(`role changed from ${old.custom_role} → ${updateData.custom_role}`);
      if (old && updateData.cities !== undefined) {
        const o = (old.cities || []).join(','), n = (updateData.cities || []).join(',');
        if (o !== n) logs.push(`cities changed from [${o}] → [${n}]`);
      }
      if (logs.length > 0) {
        await auditLog(base44, actor, 'StaffProfile Updated',
          `Admin ${actor.email} updated ${updated.email || id}: ${logs.join('; ')}`);
      }
      return Response.json({ user: updated });
    }

    // ── SEND INVITE (for existing profile) ─────────────────────────────────
    if (action === 'send_invite') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ id });
      if (!profiles || profiles.length === 0) return Response.json({ error: 'Profile not found' }, { status: 404 });
      const profile = profiles[0];
      if (!profile.email) return Response.json({ error: 'Profile has no email' }, { status: 400 });

      const email = profile.email.trim().toLowerCase();

      // Platform-native invite handles password setup
      await base44.users.inviteUser(email, 'user');

      const updated = await base44.asServiceRole.entities.StaffProfile.update(id, {
        invite_status: 'invited',
        invited_at: new Date().toISOString(),
      });
      await auditLog(base44, actor, 'Invite Sent', `Admin ${actor.email} sent invite to ${email}`);
      return Response.json({ user: updated });
    }

    // ── DEACTIVATE / REACTIVATE ────────────────────────────────────────────
    if (action === 'deactivate') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.StaffProfile.update(id, { is_active: false });
      await auditLog(base44, actor, 'StaffProfile Deactivated', `Admin ${actor.email} deactivated ${updated.email || id}`);
      return Response.json({ user: updated });
    }

    if (action === 'reactivate') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.StaffProfile.update(id, { is_active: true });
      await auditLog(base44, actor, 'StaffProfile Reactivated', `Admin ${actor.email} reactivated ${updated.email || id}`);
      return Response.json({ user: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});