import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MANAGER_ROLES = new Set(["admin","city_manager","office_finalizer","sales_manager"]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !MANAGER_ROLES.has(user.role)) {
      return Response.json({ error: "Forbidden: manager role required" }, { status: 403 });
    }

    const { template_id } = await req.json();
    if (!template_id) return Response.json({ error: "template_id required" }, { status: 400 });

    const svc = base44.asServiceRole;
    // Soft delete
    await svc.entities.TimelineTemplate.update(template_id, { is_active: false });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});