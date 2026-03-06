import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.StaffProfile.filter({ email: user.email.toLowerCase() });
    const profile = profiles?.[0];
    if (!profile || profile.is_active === false) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, entity_key, columns, filters, sort, limit, is_shared } = body;

    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
    if (!entity_key || !['events', 'leads', 'payments'].includes(entity_key)) {
      return Response.json({ error: 'Invalid entity_key' }, { status: 400 });
    }
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return Response.json({ error: 'At least one column required' }, { status: 400 });
    }

    const data = {
      name,
      entity_key,
      columns,
      filters: filters || {},
      sort: sort || '',
      limit: limit || 500,
      is_shared: is_shared === true,
    };

    if (id) {
      // Update — only owner or admin
      const existing = await base44.asServiceRole.entities.ReportDefinition.filter({ id });
      const record = existing?.[0];
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
      if (record.created_by_staff_profile_id !== profile.id && profile.custom_role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const updated = await base44.asServiceRole.entities.ReportDefinition.update(id, data);
      return Response.json({ report: updated, ok: true });
    } else {
      // Create
      data.created_by_staff_profile_id = profile.id;
      const created = await base44.asServiceRole.entities.ReportDefinition.create(data);
      return Response.json({ report: created, ok: true });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});