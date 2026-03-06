import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED_ROLES = new Set(['dj', 'client']);
const MANAGER_ROLES = new Set(['admin', 'city_manager', 'sales_manager', 'production_manager', 'office_finalizer', 'finance']);

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

    if (BLOCKED_ROLES.has(profile.custom_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, entity_key, columns, filters, sort, limit, visibility, shared_with, allow_edit_shared } = body;

    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
    if (!entity_key || !['events', 'leads', 'payments'].includes(entity_key)) {
      return Response.json({ error: 'Invalid entity_key' }, { status: 400 });
    }
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return Response.json({ error: 'At least one column required' }, { status: 400 });
    }

    const validVisibility = ['private', 'org', 'shared'].includes(visibility) ? visibility : 'private';

    const data = {
      name,
      entity_key,
      columns,
      filters: filters || {},
      sort: sort || '',
      limit: limit || 500,
      visibility: validVisibility,
      shared_with: Array.isArray(shared_with) ? shared_with : [],
      allow_edit_shared: allow_edit_shared === true,
    };

    if (id) {
      // Update — check permissions
      const existing = await base44.asServiceRole.entities.ReportDefinition.filter({ id });
      const record = existing?.[0];
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });

      const isOwner = record.created_by_staff_profile_id === profile.id;
      const isAdmin = profile.custom_role === 'admin';
      const inSharedWith = (record.shared_with || []).includes(profile.id);
      const canEdit = isOwner || isAdmin || (record.visibility === 'shared' && inSharedWith && record.allow_edit_shared === true);

      if (!canEdit) return Response.json({ error: 'Forbidden' }, { status: 403 });

      // Non-owner/non-admin can't change visibility/sharing settings
      if (!isOwner && !isAdmin) {
        data.visibility = record.visibility;
        data.shared_with = record.shared_with;
        data.allow_edit_shared = record.allow_edit_shared;
      }

      const updated = await base44.asServiceRole.entities.ReportDefinition.update(id, data);
      return Response.json({ report: updated, ok: true });
    } else {
      // Create — only manager roles
      if (!MANAGER_ROLES.has(profile.custom_role)) {
        return Response.json({ error: 'Forbidden: only managers can create reports' }, { status: 403 });
      }
      data.created_by_staff_profile_id = profile.id;
      const created = await base44.asServiceRole.entities.ReportDefinition.create(data);
      return Response.json({ report: created, ok: true });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});