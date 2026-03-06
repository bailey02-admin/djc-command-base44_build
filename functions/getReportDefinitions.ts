import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BLOCKED_ROLES = new Set(['dj', 'client']);
const MANAGER_ROLES = new Set(['admin', 'city_manager', 'sales_manager', 'production_manager', 'office_finalizer', 'finance']);

function getPerms(report, profile) {
  const role = profile.custom_role;
  const isAdmin = role === 'admin';
  const isOwner = report.created_by_staff_profile_id === profile.id;
  const isManager = MANAGER_ROLES.has(role);
  const inSharedWith = (report.shared_with || []).includes(profile.id);

  const canRun = isOwner || isAdmin ||
    report.visibility === 'org' ||
    (report.visibility === 'shared' && inSharedWith);

  const canEdit = isOwner || isAdmin ||
    (report.visibility === 'shared' && inSharedWith && report.allow_edit_shared === true);

  const canDelete = isOwner || isAdmin;
  const canShare = isOwner || isAdmin;

  return { can_run: canRun, can_edit: canEdit, can_delete: canDelete, can_share: canShare };
}

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

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (id) {
      const records = await base44.asServiceRole.entities.ReportDefinition.filter({ id });
      const report = records?.[0] || null;
      if (!report) return Response.json({ report: null });
      const perms = getPerms(report, profile);
      if (!perms.can_run) return Response.json({ error: 'Forbidden' }, { status: 403 });
      return Response.json({ report: { ...report, _perms: perms } });
    }

    // List all
    let all = await base44.asServiceRole.entities.ReportDefinition.list('-created_date', 500);

    // Filter to only accessible reports
    all = all.filter(r => {
      const perms = getPerms(r, profile);
      return perms.can_run;
    });

    // Attach permissions to each
    const reports = all.map(r => ({ ...r, _perms: getPerms(r, profile) }));

    return Response.json({ reports, total: reports.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});