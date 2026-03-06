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

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (id) {
      const records = await base44.asServiceRole.entities.ReportDefinition.filter({ id });
      const report = records?.[0] || null;
      if (!report) return Response.json({ report: null });
      // Check access
      const canRead = report.is_shared || report.created_by_staff_profile_id === profile.id || profile.custom_role === 'admin';
      if (!canRead) return Response.json({ error: 'Forbidden' }, { status: 403 });
      return Response.json({ report });
    }

    // List all
    let all = await base44.asServiceRole.entities.ReportDefinition.list('-created_date', 500);

    // Filter to only owned or shared (admins see all)
    if (profile.custom_role !== 'admin') {
      all = all.filter(r => r.is_shared || r.created_by_staff_profile_id === profile.id);
    }

    return Response.json({ reports: all, total: all.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});