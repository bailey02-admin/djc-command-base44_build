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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const actor = await base44.auth.me();
    if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (actor.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const { action, id, data = {} } = await req.json();

    if (action === 'create') {
      if (!data.role) return Response.json({ error: 'role is required' }, { status: 400 });
      if (data.role !== 'client' && !data.email) return Response.json({ error: 'email is required for staff roles' }, { status: 400 });
      if (data.role === 'client' && !data.contact_id) return Response.json({ error: 'contact_id is required for client role' }, { status: 400 });

      // Use base44.users.inviteUser to create the user record (required by platform)
      // This sets up the user with the given role; we then patch extra fields.
      await base44.users.inviteUser(data.email, data.role || 'sales_rep');

      // Fetch the newly created user by email to get their id
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const newUser = allUsers.find(u => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!newUser) return Response.json({ error: 'User created but could not be retrieved' }, { status: 500 });

      // Patch extra profile fields
      const extraFields = {};
      if (data.full_name) extraFields.full_name = data.full_name;
      if (data.phone) extraFields.phone = data.phone;
      if (data.cities?.length) extraFields.cities = data.cities;
      if (data.default_city) extraFields.default_city = data.default_city;
      if (data.contact_id) extraFields.contact_id = data.contact_id;
      if (data.notes) extraFields.notes = data.notes;
      extraFields.is_active = data.is_active !== false;
      extraFields.invite_status = 'invited';

      const updated = Object.keys(extraFields).length > 0
        ? await base44.asServiceRole.entities.User.update(newUser.id, extraFields)
        : newUser;

      await auditLog(base44, actor, 'User Created',
        `Admin ${actor.email} created user ${updated.email} with role=${data.role} cities=${(data.cities||[]).join(',') || 'none'}`);
      return Response.json({ user: updated });
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      // Fetch old user to diff role/city changes
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const oldUser = allUsers.find(u => u.id === id);
      const updated = await base44.asServiceRole.entities.User.update(id, data);

      const logs = [];
      if (oldUser && data.role && oldUser.role !== data.role) {
        logs.push(`role changed from ${oldUser.role} → ${data.role}`);
      }
      if (oldUser && data.cities !== undefined) {
        const oldCities = (oldUser.cities || []).join(',');
        const newCities = (data.cities || []).join(',');
        if (oldCities !== newCities) logs.push(`cities changed from [${oldCities}] → [${newCities}]`);
      }
      if (logs.length > 0) {
        await auditLog(base44, actor, 'User Updated',
          `Admin ${actor.email} updated user ${updated.email || id}: ${logs.join('; ')}`);
      }
      return Response.json({ user: updated });
    }

    if (action === 'deactivate') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.User.update(id, { is_active: false });
      await auditLog(base44, actor, 'User Deactivated',
        `Admin ${actor.email} deactivated user ${updated.email || id}`);
      return Response.json({ user: updated });
    }

    if (action === 'reactivate') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.User.update(id, { is_active: true });
      await auditLog(base44, actor, 'User Reactivated',
        `Admin ${actor.email} reactivated user ${updated.email || id}`);
      return Response.json({ user: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});