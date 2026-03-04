import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const { action, id, data = {} } = await req.json();

    if (action === 'create') {
      if (!data.role) return Response.json({ error: 'role is required' }, { status: 400 });
      if (data.role !== 'client' && !data.email) return Response.json({ error: 'email is required for staff roles' }, { status: 400 });
      if (data.role === 'client' && !data.contact_id) return Response.json({ error: 'contact_id is required for client role' }, { status: 400 });

      const newUser = await base44.asServiceRole.entities.User.create({
        ...data,
        is_active: data.is_active !== false,
        invite_status: data.invite_status || 'not_invited',
        cities: data.cities || [],
      });
      return Response.json({ user: newUser });
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.User.update(id, data);
      return Response.json({ user: updated });
    }

    if (action === 'deactivate') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.User.update(id, { is_active: false });
      return Response.json({ user: updated });
    }

    if (action === 'reactivate') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.User.update(id, { is_active: true });
      return Response.json({ user: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});